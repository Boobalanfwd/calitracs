import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { DeviceToken } from '../models/DeviceToken';
import { NotificationPreference, NotificationCategory } from '../models/NotificationPreference';
import { NotificationLog } from '../models/NotificationLog';
import { enqueueNotification } from '../services/notificationWorker';
import { isValidTimezone } from '../utils/validation';

const ALL_CATEGORIES: NotificationCategory[] = [
  'meal_reminder',
  'water_reminder',
  'daily_checkin',
  'calorie_goal',
  'streak',
  'weekly_summary',
  'inactivity',
];

const MAX_EXPO_TOKEN_LEN = 200;

/**
 * POST /api/notifications/register-token
 * Register or refresh a device's Expo push token.
 */
export async function registerToken(req: Request, res: Response): Promise<void> {
  try {
    const { expoPushToken, platform } = req.body as {
      expoPushToken: string;
      platform: 'ios' | 'android';
    };
    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    if (!expoPushToken || !platform) {
      res.status(400).json({ success: false, error: 'expoPushToken and platform are required' });
      return;
    }

    if (!['ios', 'android'].includes(platform)) {
      res.status(400).json({ success: false, error: 'platform must be "ios" or "android"' });
      return;
    }

    if (typeof expoPushToken !== 'string' || expoPushToken.length > MAX_EXPO_TOKEN_LEN) {
      res.status(400).json({ success: false, error: `expoPushToken must be ${MAX_EXPO_TOKEN_LEN} characters or fewer.` });
      return;
    }

    // Upsert token — if the same token exists, update its userId and mark valid
    const token = await DeviceToken.findOneAndUpdate(
      { expoPushToken },
      { userId, platform, isValid: true },
      { upsert: true, new: true }
    );

    // Seed default notification preferences for this user if not set
    const existingPrefs = await NotificationPreference.find({ userId });
    const existingCategories = existingPrefs.map((p) => p.category);

    const missing = ALL_CATEGORIES.filter((c) => !existingCategories.includes(c));
    if (missing.length > 0) {
      await NotificationPreference.insertMany(
        missing.map((category) => ({
          userId,
          category,
          enabled: true,
          quietHoursStart: 22,
          quietHoursEnd: 7,
          timezone: 'Asia/Kolkata',
        }))
      );
    }

    console.log(`[NotificationController] Token registered for user ${userId}, platform: ${platform}`);
    res.json({ success: true, tokenId: token._id });
  } catch (err: any) {
    console.error('[NotificationController] registerToken error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to register push token' });
  }
}

/**
 * GET /api/notifications/preferences
 * Get all notification preferences for the authenticated user.
 */
export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const prefs = await NotificationPreference.find({ userId });
    res.json({ success: true, preferences: prefs });
  } catch (err: any) {
    console.error('[NotificationController] getPreferences error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
}

/**
 * PUT /api/notifications/preferences
 * Update one or more notification category preferences.
 * Body: { preferences: [{ category, enabled, quietHoursStart, quietHoursEnd, timezone }] }
 */
export async function updatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const { preferences } = req.body as {
      preferences: Array<{
        category: NotificationCategory;
        enabled?: boolean;
        quietHoursStart?: number;
        quietHoursEnd?: number;
        timezone?: string;
      }>;
    };

    if (!Array.isArray(preferences) || preferences.length === 0) {
      res.status(400).json({ success: false, error: 'preferences array is required' });
      return;
    }

    // Validate every pref before touching the DB — findOneAndUpdate upserts run
    // no schema validators, so bad categories/hours would otherwise persist.
    for (const p of preferences) {
      if (!p || typeof p !== 'object') {
        res.status(400).json({ success: false, error: 'Each preference must be an object.' });
        return;
      }
      if (typeof p.category !== 'string' || !(ALL_CATEGORIES as string[]).includes(p.category)) {
        res.status(400).json({ success: false, error: `category must be one of: ${ALL_CATEGORIES.join(', ')}` });
        return;
      }
      if (
        p.quietHoursStart !== undefined &&
        (typeof p.quietHoursStart !== 'number' || !Number.isInteger(p.quietHoursStart) || p.quietHoursStart < 0 || p.quietHoursStart > 23)
      ) {
        res.status(400).json({ success: false, error: 'quietHoursStart must be an integer between 0 and 23.' });
        return;
      }
      if (
        p.quietHoursEnd !== undefined &&
        (typeof p.quietHoursEnd !== 'number' || !Number.isInteger(p.quietHoursEnd) || p.quietHoursEnd < 0 || p.quietHoursEnd > 23)
      ) {
        res.status(400).json({ success: false, error: 'quietHoursEnd must be an integer between 0 and 23.' });
        return;
      }
      if (p.enabled !== undefined && typeof p.enabled !== 'boolean') {
        res.status(400).json({ success: false, error: 'enabled must be a boolean.' });
        return;
      }
      if (p.timezone !== undefined && !isValidTimezone(p.timezone)) {
        res.status(400).json({ success: false, error: 'timezone must be a valid IANA timezone (e.g. "Asia/Kolkata").' });
        return;
      }
    }

    const updated = await Promise.all(
      preferences.map(async (p) => {
        return NotificationPreference.findOneAndUpdate(
          { userId, category: p.category },
          {
            enabled: p.enabled,
            ...(p.quietHoursStart !== undefined && { quietHoursStart: p.quietHoursStart }),
            ...(p.quietHoursEnd !== undefined && { quietHoursEnd: p.quietHoursEnd }),
            ...(p.timezone && { timezone: p.timezone }),
          },
          { upsert: true, new: true, runValidators: true }
        );
      })
    );

    res.json({ success: true, updated });
  } catch (err: any) {
    console.error('[NotificationController] updatePreferences error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
}

/**
 * GET /api/notifications/logs
 * Get last 50 notification delivery logs for the user.
 */
export async function getLogs(req: Request, res: Response): Promise<void> {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const logs = await NotificationLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-expoPushToken'); // don't expose token in response

    res.json({ success: true, logs });
  } catch (err: any) {
    console.error('[NotificationController] getLogs error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch notification logs' });
  }
}

/**
 * POST /api/notifications/test
 * Dev helper: send a test push to the calling user.
 */
export async function sendTestPush(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    await enqueueNotification(
      userId,
      'calorie_goal',
      '🧪 Test Push — Calitracs',
      'Your push notification system is working correctly! Tap to open the app.',
      { screen: 'dashboard', type: 'test' }
    );
    res.json({ success: true, message: 'Test push queued' });
  } catch (err: any) {
    console.error('[NotificationController] sendTestPush error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to queue test push' });
  }
}
