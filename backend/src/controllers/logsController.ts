import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { FoodLog, MealType } from '../models/FoodLog';
import { DailyTarget } from '../models/DailyTarget';
import { onCaloriesGoalHit } from '../services/notificationOrchestrator';

function todayDate(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── Get Log for a Date ────────────────────────────────────────────────────────
export const getLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.params.date === 'today' ? todayDate() : req.params.date;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
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

    // Validate required fields
    if (!name?.trim() || typeof calories !== 'number' || calories < 0) {
      res.status(400).json({ success: false, error: 'Food name and calories (≥0) are required.' });
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
      proteinG: Math.round((proteinG || 0) * 10) / 10,
      carbsG: Math.round((carbsG || 0) * 10) / 10,
      fatG: Math.round((fatG || 0) * 10) / 10,
      portionUnit: portionUnit || 'g',
      portionQuantity: typeof portionQuantity === 'number' ? portionQuantity : 1,
      weightGramsOrMl: typeof weightGramsOrMl === 'number' ? weightGramsOrMl : (portionG || 100),
      portionG: portionG || weightGramsOrMl || undefined,
      portionDescription: portionDescription || undefined,
      isLiquid: Boolean(isLiquid),
      source: source || 'manual',
      nutritionSource: nutritionSource || 'manual',
      confidence: confidence ?? undefined,
      imageUrl: imageUrl || undefined,
      addedAt: new Date(),
    };

    // Upsert: find or create log for this date
    let log = await FoodLog.findOne({ userId: req.user!.userId, date: logDate });
    if (log) {
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

    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
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
      }).select('date totalCalories totalProteinG totalCarbsG totalFatG'),
      DailyTarget.findOne({ userId: req.user!.userId }),
    ]);

    const targetCalories = target?.calories ?? 2000;
    const days = logs.map((log) => ({
      date: log.date,
      totalCalories: log.totalCalories,
      totalProteinG: log.totalProteinG,
      totalCarbsG: log.totalCarbsG,
      totalFatG: log.totalFatG,
      targetCalories,
      percentage: Math.round((log.totalCalories / targetCalories) * 100),
    }));

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

    if (typeof amountMl !== 'number' || isNaN(amountMl) || amountMl < 0) {
      res.status(400).json({ success: false, error: 'Valid water amount in ml (≥ 0) is required.' });
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

    if (mode === 'set') {
      log.waterIntakeMl = Math.max(0, Math.round(amountMl));
      log.waterLogs = amountMl > 0 ? [{ _id: new mongoose.Types.ObjectId(), amountMl: log.waterIntakeMl, addedAt: new Date() } as any] : [];
    } else {
      // Default: 'add'
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
    if (startDate && typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      start = new Date(startDate);
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
