import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { FoodLog, MealType } from '../models/FoodLog';
import { DailyTarget } from '../models/DailyTarget';
import { onCaloriesGoalHit } from '../services/notificationOrchestrator';
import {
  isValidDateKey,
  isFiniteNumber,
  clampNumber,
  ENTRY_LIMITS,
  WATER_LIMITS,
} from '../utils/validation';

function todayDate(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD (server-UTC "today")
}

// Hard cap on per-day entries and water logs — a single FoodLog document must
// stay well under MongoDB's 16MB document size limit.
const MAX_ENTRIES_PER_DAY = 200;
const MAX_WATER_LOGS_PER_DAY = 200;

const VALID_NUTRITION_SOURCES = ['nutritionix', 'openfoodfacts', 'usda', 'gemini_estimate', 'manual'];

// ── Get Log for a Date ────────────────────────────────────────────────────────
export const getLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.params.date === 'today' ? todayDate() : req.params.date;

    // Validate date format
    if (!isValidDateKey(date)) {
      res.status(400).json({ success: false, error: 'Invalid date. Use a real YYYY-MM-DD date.' });
      return;
    }

    const [log, target] = await Promise.all([
      FoodLog.findOne({ userId: req.user!.userId, date }),
      DailyTarget.findOne({ userId: req.user!.userId }),
    ]);

    res.json({
      success: true,
      date,
      log: log ?? { entries: [], waterIntakeMl: 0, waterLogs: [], totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 },
      targets: target ?? { calories: 2000, proteinG: 150, carbsG: 225, fatG: 65, waterMl: 2000 },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch log.' });
  }
};

// ── Add Entry ─────────────────────────────────────────────────────────────────
export const addEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      date,
      meal,
      name,
      calories,
      proteinG,
      carbsG,
      fatG,
      portionUnit,
      portionQuantity,
      weightGramsOrMl,
      portionG,
      portionDescription,
      isLiquid,
      source,
      nutritionSource,
      confidence,
      imageUrl,
    } = req.body;

    const logDate = date || todayDate();

    // Validate required fields — numbers must be finite and within sane bounds.
    // A plain `typeof x === 'number'` check lets NaN/Infinity slip through.
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Food name is required.' });
      return;
    }
    if (name.trim().length > ENTRY_LIMITS.nameLen) {
      res.status(400).json({ success: false, error: `Food name must be ${ENTRY_LIMITS.nameLen} characters or fewer.` });
      return;
    }
    if (
      !isFiniteNumber(calories) ||
      calories < ENTRY_LIMITS.calories.min ||
      calories > ENTRY_LIMITS.calories.max
    ) {
      res.status(400).json({ success: false, error: `Calories must be a number between ${ENTRY_LIMITS.calories.min} and ${ENTRY_LIMITS.calories.max}.` });
      return;
    }
    const roundMacro = (v: unknown): number | null => {
      if (v === undefined || v === null) return 0;
      const n = Number(v);
      if (!Number.isFinite(n) || n < ENTRY_LIMITS.macroG.min || n > ENTRY_LIMITS.macroG.max) return null;
      return Math.round(n * 10) / 10;
    };
    const proteinGVal = roundMacro(proteinG);
    const carbsGVal = roundMacro(carbsG);
    const fatGVal = roundMacro(fatG);
    if (proteinGVal === null || carbsGVal === null || fatGVal === null) {
      res.status(400).json({
        success: false,
        error: `Protein, carbs, and fat must be numbers between ${ENTRY_LIMITS.macroG.min} and ${ENTRY_LIMITS.macroG.max}.`,
      });
      return;
    }
    if (
      weightGramsOrMl !== undefined &&
      (!isFiniteNumber(weightGramsOrMl) ||
        weightGramsOrMl < ENTRY_LIMITS.weightGramsOrMl.min ||
        weightGramsOrMl > ENTRY_LIMITS.weightGramsOrMl.max)
    ) {
      res.status(400).json({
        success: false,
        error: `Weight must be a number between ${ENTRY_LIMITS.weightGramsOrMl.min} and ${ENTRY_LIMITS.weightGramsOrMl.max} g/ml.`,
      });
      return;
    }
    if (
      portionQuantity !== undefined &&
      (!isFiniteNumber(portionQuantity) ||
        portionQuantity < ENTRY_LIMITS.portionQuantity.min ||
        portionQuantity > ENTRY_LIMITS.portionQuantity.max)
    ) {
      res.status(400).json({
        success: false,
        error: `Portion quantity must be a number between ${ENTRY_LIMITS.portionQuantity.min} and ${ENTRY_LIMITS.portionQuantity.max}.`,
      });
      return;
    }
    if (
      portionG !== undefined &&
      (!isFiniteNumber(portionG) || portionG < ENTRY_LIMITS.portionG.min || portionG > ENTRY_LIMITS.portionG.max)
    ) {
      res.status(400).json({
        success: false,
        error: `Portion size must be a number between ${ENTRY_LIMITS.portionG.min} and ${ENTRY_LIMITS.portionG.max} g/ml.`,
      });
      return;
    }
    if (confidence !== undefined && !isFiniteNumber(confidence)) {
      res.status(400).json({ success: false, error: 'Confidence must be a number.' });
      return;
    }
    if (source !== undefined && source !== 'ai' && source !== 'manual') {
      res.status(400).json({ success: false, error: 'source must be "ai" or "manual".' });
      return;
    }
    if (
      nutritionSource !== undefined &&
      (typeof nutritionSource !== 'string' || !VALID_NUTRITION_SOURCES.includes(nutritionSource))
    ) {
      res.status(400).json({ success: false, error: `nutritionSource must be one of: ${VALID_NUTRITION_SOURCES.join(', ')}` });
      return;
    }
    if (
      portionDescription !== undefined &&
      (typeof portionDescription !== 'string' || portionDescription.length > ENTRY_LIMITS.portionDescriptionLen)
    ) {
      res.status(400).json({ success: false, error: `Portion description must be ${ENTRY_LIMITS.portionDescriptionLen} characters or fewer.` });
      return;
    }
    if (
      imageUrl !== undefined &&
      (typeof imageUrl !== 'string' || imageUrl.length > ENTRY_LIMITS.imageUrlLen)
    ) {
      res.status(400).json({ success: false, error: `Image URL must be ${ENTRY_LIMITS.imageUrlLen} characters or fewer.` });
      return;
    }
    if (!isValidDateKey(logDate)) {
      res.status(400).json({ success: false, error: 'Invalid date. Use a real YYYY-MM-DD date.' });
      return;
    }

    const validMeals: MealType[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];
    if (!validMeals.includes(meal)) {
      res.status(400).json({ success: false, error: `Invalid meal. Choose: ${validMeals.join(', ')}` });
      return;
    }

    const entry = {
      _id: new mongoose.Types.ObjectId(),
      name: name.trim(),
      meal,
      calories: Math.round(calories),
      proteinG: proteinGVal,
      carbsG: carbsGVal,
      fatG: fatGVal,
      portionUnit: portionUnit || 'g',
      portionQuantity: isFiniteNumber(portionQuantity) ? portionQuantity : 1,
      weightGramsOrMl: isFiniteNumber(weightGramsOrMl)
        ? weightGramsOrMl
        : (isFiniteNumber(portionG) ? portionG : 100),
      portionG: isFiniteNumber(portionG) ? portionG : isFiniteNumber(weightGramsOrMl) ? weightGramsOrMl : undefined,
      portionDescription: portionDescription || undefined,
      isLiquid: Boolean(isLiquid),
      source: source || 'manual',
      nutritionSource: nutritionSource || 'manual',
      confidence: isFiniteNumber(confidence) ? clampNumber(confidence, 0, 1) : undefined,
      imageUrl: imageUrl || undefined,
      addedAt: new Date(),
    };

    // Upsert: find or create log for this date
    let log = await FoodLog.findOne({ userId: req.user!.userId, date: logDate });
    if (log) {
      if (log.entries.length >= MAX_ENTRIES_PER_DAY) {
        res.status(400).json({ success: false, error: `You've hit the daily entry limit (${MAX_ENTRIES_PER_DAY}).` });
        return;
      }
      log.entries.push(entry as any);
      await log.save(); // pre-hook recalculates totals
    } else {
      log = await FoodLog.create({
        userId: req.user!.userId,
        date: logDate,
        entries: [entry],
      });
    }

    // Fire calorie goal notification trigger (async — don't block response)
    const userId = req.user!.userId;
    DailyTarget.findOne({ userId }).then((target) => {
      if (target && log) {
        onCaloriesGoalHit(userId, log.totalCalories, target.calories).catch(() => {});
      }
    }).catch(() => {});

    res.status(201).json({ success: true, log, entryId: entry._id });
  } catch (err) {
    console.error('[Logs] Add entry error:', err);
    res.status(500).json({ success: false, error: 'Failed to add food entry.' });
  }
};

// ── Delete Entry ──────────────────────────────────────────────────────────────
export const deleteEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entryId } = req.params;
    const date = req.query.date as string || todayDate();

    if (!isValidDateKey(date)) {
      res.status(400).json({ success: false, error: 'Invalid date. Use a real YYYY-MM-DD date.' });
      return;
    }

    const log = await FoodLog.findOne({ userId: req.user!.userId, date });
    if (!log) {
      res.status(404).json({ success: false, error: 'Log not found for this date.' });
      return;
    }

    const before = log.entries.length;
    log.entries = log.entries.filter((e) => e._id.toString() !== entryId) as any;

    if (log.entries.length === before) {
      res.status(404).json({ success: false, error: 'Entry not found.' });
      return;
    }

    await log.save();
    res.json({ success: true, log });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete entry.' });
  }
};

// ── Calendar Month ────────────────────────────────────────────────────────────
export const getCalendarMonth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, month } = req.params;
    const y = parseInt(year);
    const m = parseInt(month); // 1-12

    if (isNaN(y) || isNaN(m) || y < 2000 || y > 2100 || m < 1 || m > 12) {
      res.status(400).json({ success: false, error: 'Invalid year or month.' });
      return;
    }

    // Date range for this month
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [logs, target] = await Promise.all([
      FoodLog.find({
        userId: req.user!.userId,
        date: { $gte: startDate, $lte: endDate },
      }).select('date totalCalories totalProteinG totalCarbsG totalFatG entries'),
      DailyTarget.findOne({ userId: req.user!.userId }),
    ]);

    const targetCalories = target?.calories ?? 2000;
    const days = logs.map((log) => {
      let cal = log.totalCalories || 0;
      if (cal === 0 && log.entries && log.entries.length > 0) {
        cal = log.entries.reduce((sum, e) => sum + (e.calories || 0), 0);
      }
      return {
        date: log.date,
        totalCalories: cal,
        totalProteinG: log.totalProteinG || 0,
        totalCarbsG: log.totalCarbsG || 0,
        totalFatG: log.totalFatG || 0,
        targetCalories,
        percentage: Math.round((cal / targetCalories) * 100),
      };
    });

    res.json({ success: true, year: y, month: m, targetCalories, days });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch calendar data.' });
  }
};

// ── Water Intake Management ───────────────────────────────────────────────────
export const updateWaterIntake = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, amountMl, mode } = req.body; // mode: 'add' | 'set'
    const logDate = date || todayDate();
    const effectiveMode = mode || 'add';

    if (!isValidDateKey(logDate)) {
      res.status(400).json({ success: false, error: 'Invalid date. Use a real YYYY-MM-DD date.' });
      return;
    }

    if (effectiveMode !== 'add' && effectiveMode !== 'set') {
      res.status(400).json({ success: false, error: 'mode must be "add" or "set".' });
      return;
    }

    if (
      !isFiniteNumber(amountMl) ||
      amountMl < WATER_LIMITS.amountMl.min ||
      amountMl > WATER_LIMITS.amountMl.max
    ) {
      res.status(400).json({
        success: false,
        error: `Valid water amount in ml (${WATER_LIMITS.amountMl.min}–${WATER_LIMITS.amountMl.max}) is required.`,
      });
      return;
    }

    let log = await FoodLog.findOne({ userId: req.user!.userId, date: logDate });

    if (!log) {
      log = new FoodLog({
        userId: req.user!.userId,
        date: logDate,
        entries: [],
        waterIntakeMl: 0,
        waterLogs: [],
      });
    }

    if (effectiveMode === 'set') {
      log.waterIntakeMl = Math.round(amountMl);
      log.waterLogs = amountMl > 0 ? [{ _id: new mongoose.Types.ObjectId(), amountMl: log.waterIntakeMl, addedAt: new Date() } as any] : [];
    } else {
      // Default: 'add'
      if (amountMl < 1) {
        res.status(400).json({ success: false, error: 'Water amount must be at least 1 ml.' });
        return;
      }
      if (log.waterLogs.length >= MAX_WATER_LOGS_PER_DAY) {
        res.status(400).json({ success: false, error: `You've hit the daily water entry limit (${MAX_WATER_LOGS_PER_DAY}).` });
        return;
      }
      const newEntry = {
        _id: new mongoose.Types.ObjectId(),
        amountMl: Math.round(amountMl),
        addedAt: new Date(),
      };
      log.waterLogs.push(newEntry as any);
      log.waterIntakeMl = log.waterLogs.reduce((sum, w) => sum + (w.amountMl || 0), 0);
    }

    await log.save();
    res.json({ success: true, log });
  } catch (err) {
    console.error('[LogsController] Update water intake error:', err);
    res.status(500).json({ success: false, error: 'Failed to update water intake.' });
  }
};

export const deleteWaterEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { waterId } = req.params;
    const date = (req.query.date as string) || todayDate();

    if (!isValidDateKey(date)) {
      res.status(400).json({ success: false, error: 'Invalid date. Use a real YYYY-MM-DD date.' });
      return;
    }

    const log = await FoodLog.findOne({ userId: req.user!.userId, date });
    if (!log) {
      res.status(404).json({ success: false, error: 'Log not found for this date.' });
      return;
    }

    const initialCount = log.waterLogs.length;
    log.waterLogs = log.waterLogs.filter((w) => w._id.toString() !== waterId) as any;

    if (log.waterLogs.length === initialCount) {
      res.status(404).json({ success: false, error: 'Water entry not found.' });
      return;
    }

    log.waterIntakeMl = log.waterLogs.reduce((sum, w) => sum + (w.amountMl || 0), 0);
    await log.save();

    res.json({ success: true, log });
  } catch (err) {
    console.error('[LogsController] Delete water entry error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete water entry.' });
  }
};
// ── Weekly Water Intake ───────────────────────────────────────────────────────
// GET /api/logs/water/weekly?startDate=YYYY-MM-DD
// Returns 7 days of water intake starting from startDate (Mon-Sun)
export const getWeeklyWater = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate } = req.query;

    // Build 7-day range
    let start: Date;
    if (startDate !== undefined) {
      if (typeof startDate !== 'string' || !isValidDateKey(startDate)) {
        res.status(400).json({ success: false, error: 'Invalid startDate. Use a real YYYY-MM-DD date.' });
        return;
      }
      start = new Date(`${startDate}T00:00:00Z`);
    } else {
      // Default: current Monday
      const now = new Date();
      const dow = now.getDay(); // 0 = Sun
      const distToMon = dow === 0 ? -6 : 1 - dow;
      start = new Date(now);
      start.setDate(now.getDate() + distToMon);
    }

    const days: { date: string; waterMl: number }[] = [];
    const dateStrings: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      dateStrings.push(dateStr);
      days.push({ date: dateStr, waterMl: 0 }); // default 0
    }

    const [logs, target] = await Promise.all([
      FoodLog.find({
        userId: req.user!.userId,
        date: { $in: dateStrings },
      }).select('date waterIntakeMl'),
      DailyTarget.findOne({ userId: req.user!.userId }),
    ]);

    // Merge DB values into the 7-day array
    const logMap = new Map(logs.map((l) => [l.date, l.waterIntakeMl]));
    for (const day of days) {
      if (logMap.has(day.date)) {
        day.waterMl = logMap.get(day.date)!;
      }
    }

    const targetWaterMl = target?.waterMl ?? 2000;
    const totalWaterMl = days.reduce((sum, d) => sum + d.waterMl, 0);
    const avgWaterMl = Math.round(totalWaterMl / 7);

    res.json({
      success: true,
      days,
      targetWaterMl,
      totalWaterMl,
      avgWaterMl,
    });
  } catch (err) {
    console.error('[LogsController] Weekly water error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch weekly water data.' });
  }
};
