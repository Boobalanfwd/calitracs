import { Request, Response } from 'express';
import { DailyTarget, calculateSuggestedTargets } from '../models/DailyTarget';
import { User } from '../models/User';

// ── Get Targets ───────────────────────────────────────────────────────────────
export const getTargets = async (req: Request, res: Response): Promise<void> => {
  try {
    const target = await DailyTarget.findOne({ userId: req.user!.userId });
    if (!target) {
      res.status(404).json({ success: false, error: 'No targets found. Please complete onboarding.' });
      return;
    }
    res.json({ success: true, targets: target });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch targets.' });
  }
};

// ── Update Targets ────────────────────────────────────────────────────────────
export const updateTargets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { calories, proteinG, carbsG, fatG, waterMl } = req.body;

    if (
      typeof calories !== 'number' || calories < 500 || calories > 10000 ||
      typeof proteinG !== 'number' || proteinG < 0 ||
      typeof carbsG !== 'number' || carbsG < 0 ||
      typeof fatG !== 'number' || fatG < 0 ||
      (waterMl !== undefined && (typeof waterMl !== 'number' || waterMl < 500 || waterMl > 10000))
    ) {
      res.status(400).json({ success: false, error: 'Invalid target values.' });
      return;
    }

    const updateFields: any = { calories, proteinG, carbsG, fatG };
    if (typeof waterMl === 'number') {
      updateFields.waterMl = waterMl;
    }

    const target = await DailyTarget.findOneAndUpdate(
      { userId: req.user!.userId },
      updateFields,
      { new: true, upsert: true }
    );

    res.json({ success: true, targets: target });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update targets.' });
  }
};

// ── Get Suggested Targets (from profile) ─────────────────────────────────────
export const getSuggestedTargets = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    const p = user.profile;
    if (!p.age || !p.weightKg || !p.heightCm || !p.activityLevel || !p.goal || !p.gender) {
      res.status(400).json({
        success: false,
        error: 'Profile incomplete. Age, weight, height, activity level, goal, and gender are required.',
      });
      return;
    }

    const suggested = calculateSuggestedTargets(
      p.age, p.weightKg, p.heightCm, p.gender, p.activityLevel, p.goal
    );

    res.json({ success: true, suggested });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to calculate suggested targets.' });
  }
};
