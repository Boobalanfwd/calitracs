import cron from 'node-cron';
import mongoose from 'mongoose';
import { FoodLog } from '../models/FoodLog';
import { DailyTarget } from '../models/DailyTarget';
import { User } from '../models/User';
import { enqueueNotification } from './notificationWorker';

// ─── Event-Based Triggers ──────────────────────────────────────────────────

/**
 * Called after a food log entry is saved. Fires calorie goal push when
 * the user is within 5% of or has exceeded their daily calorie target.
 */
export async function onCaloriesGoalHit(
  userId: mongoose.Types.ObjectId | string,
  consumedCalories: number,
  targetCalories: number
): Promise<void> {
  if (!targetCalories || targetCalories <= 0) return;
  const pct = consumedCalories / targetCalories;

  try {
    if (pct >= 1.0) {
      await enqueueNotification(
        userId,
        'calorie_goal',
        '🎯 Daily Calorie Goal Reached!',
        `You've logged ${Math.round(consumedCalories)} kcal — your goal is ${targetCalories} kcal. Great job staying on track!`,
        { screen: 'dashboard', type: 'calorie_goal' }
      );
      console.log(`[Orchestrator] Calorie goal reached push queued for user ${userId}`);
    } else if (pct >= 0.95) {
      await enqueueNotification(
        userId,
        'calorie_goal',
        '🔥 Almost at Your Calorie Goal!',
        `You're ${Math.round(targetCalories - consumedCalories)} kcal away from your daily target of ${targetCalories} kcal.`,
        { screen: 'dashboard', type: 'calorie_goal_near' }
      );
      console.log(`[Orchestrator] Calorie near-goal push queued for user ${userId}`);
    }
  } catch (err: any) {
    console.error('[Orchestrator] onCaloriesGoalHit error:', err.message);
  }
}

/**
 * Called when a streak break is detected. Fires a motivational re-engagement push.
 */
export async function onStreakBroken(
  userId: mongoose.Types.ObjectId | string,
  previousStreakDays: number
): Promise<void> {
  try {
    await enqueueNotification(
      userId,
      'streak',
      '😢 Your Streak Ended',
      `Your ${previousStreakDays}-day streak ended. Log a meal today to start a new one — you got this! 💪`,
      { screen: 'log', type: 'streak_broken' }
    );
    console.log(`[Orchestrator] Streak broken push queued for user ${userId}`);
  } catch (err: any) {
    console.error('[Orchestrator] onStreakBroken error:', err.message);
  }
}

// ─── Cron-Based Triggers ───────────────────────────────────────────────────

/**
 * Nightly inactivity scan — 9 PM daily.
 * Find users who have not logged any food today and send re-engagement push.
 */
function scheduleInactivityScan(): void {
  cron.schedule('0 21 * * *', async () => {
    console.log('[Orchestrator] Running nightly inactivity scan...');
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Find all users who have logged today
      const activeLogs = await FoodLog.distinct('userId', {
        date: today,
        totalCalories: { $gt: 0 },
      });

      const activeSet = new Set(activeLogs.map((id: any) => id.toString()));

      // Find all real (non-guest) users
      const allUsers = await User.find({ isGuest: false }, { _id: 1, name: 1 });

      const inactiveUsers = allUsers.filter((u) => !activeSet.has(u._id.toString()));

      console.log(`[Orchestrator] ${inactiveUsers.length} inactive users found for ${today}`);

      for (const u of inactiveUsers) {
        await enqueueNotification(
          u._id,
          'inactivity',
          '👋 Don\'t forget to log today!',
          `Hey ${u.name?.split(' ')[0] || 'there'}! You haven't logged any meals yet today. Tap to track your nutrition with AI. 🥗`,
          { screen: 'log', type: 'inactivity' }
        );
      }
    } catch (err: any) {
      console.error('[Orchestrator] Inactivity scan error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[Orchestrator] Inactivity scan cron scheduled (9 PM daily)');
}

/**
 * Weekly summary — Monday 8 AM.
 * Send a personalized weekly recap push to all active users.
 */
function scheduleWeeklySummary(): void {
  cron.schedule('0 8 * * 1', async () => {
    console.log('[Orchestrator] Running weekly summary push...');
    try {
      // Look back 7 days
      const dates: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      // Get users who logged at least 3 days this week
      const activeThisWeek = await FoodLog.aggregate([
        { $match: { date: { $in: dates }, totalCalories: { $gt: 0 } } },
        { $group: { _id: '$userId', days: { $sum: 1 } } },
        { $match: { days: { $gte: 3 } } },
      ]);

      console.log(`[Orchestrator] ${activeThisWeek.length} users eligible for weekly summary`);

      for (const entry of activeThisWeek) {
        await enqueueNotification(
          entry._id,
          'weekly_summary',
          '📊 Your Weekly Nutrition Summary',
          `You logged meals on ${entry.days} of 7 days this week. Check your weekly insights now! 🎉`,
          { screen: 'dashboard', type: 'weekly_summary' }
        );
      }
    } catch (err: any) {
      console.error('[Orchestrator] Weekly summary error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[Orchestrator] Weekly summary cron scheduled (Monday 8 AM)');
}

/**
 * Start all cron-based notification triggers. Call once on server boot.
 */
export function startNotificationOrchestrator(): void {
  scheduleInactivityScan();
  scheduleWeeklySummary();
  console.log('[Orchestrator] All notification triggers active');
}
