import { DeviceToken } from '../models/DeviceToken';
import { NotificationPreference } from '../models/NotificationPreference';
import { NotificationQueue, INotificationQueue } from '../models/NotificationQueue';
import { NotificationLog } from '../models/NotificationLog';
import { sendBatch, pollReceipts, ExpoPushMessage } from './expoPushService';
import mongoose from 'mongoose';

const ACTIVE_POLL_INTERVAL_MS = 10_000; // poll every 10s while jobs are pending
const IDLE_POLL_INTERVAL_MS = 60_000;   // back off to 60s when the queue is empty
const RECEIPT_DELAY_MS = 30_000;   // poll receipts 30s after sending
const TERMINAL_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // purge done/failed after 7 days
const STALE_PROCESSING_MS = 5 * 60 * 1000; // reclaim jobs stuck 'processing' after 5 min
let workerRunning = false;
let workerTimer: NodeJS.Timeout | null = null;
const pendingReceiptPoll: Array<{ receiptId: string; logId: string }> = [];
let receiptRequeueDone = false;

// Lifetime counters for observability (exposed via /health and /metrics).
const workerStats = {
  ticks: 0,
  processed: 0,
  failed: 0,
  sent: 0,
  reclaimed: 0,
  purged: 0,
  lastTickAt: null as number | null,
};

export function getWorkerStats(): {
  running: boolean;
  ticks: number;
  processed: number;
  failed: number;
  sent: number;
  reclaimed: number;
  purged: number;
  lastTickAt: string | null;
} {
  return {
    running: workerRunning,
    ticks: workerStats.ticks,
    processed: workerStats.processed,
    failed: workerStats.failed,
    sent: workerStats.sent,
    reclaimed: workerStats.reclaimed,
    purged: workerStats.purged,
    lastTickAt: workerStats.lastTickAt ? new Date(workerStats.lastTickAt).toISOString() : null,
  };
}

export function resetWorkerStats(): void {
  workerStats.ticks = 0;
  workerStats.processed = 0;
  workerStats.failed = 0;
  workerStats.sent = 0;
  workerStats.reclaimed = 0;
  workerStats.purged = 0;
  workerStats.lastTickAt = null;
}

/**
 * Current hour-of-day (0-23) in the given IANA timezone. Falls back to UTC.
 */
export function getHourInTimezone(timezone: string | undefined, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    const hour = hourPart ? parseInt(hourPart.value, 10) : 0;
    return hour % 24; // some engines emit "24" for midnight
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Check if `now` is within quiet hours for a given preference.
 * Evaluated in the user's stored timezone (not the server's).
 */
export function isQuietHours(pref: { quietHoursStart: number; quietHoursEnd: number; timezone?: string }, now: Date = new Date()): boolean {
  const hour = getHourInTimezone(pref.timezone, now);
  const { quietHoursStart: start, quietHoursEnd: end } = pref;
  if (start <= end) {
    // e.g. quiet 01:00–06:00
    return hour >= start && hour < end;
  } else {
    // e.g. quiet 22:00–07:00 (crosses midnight)
    return hour >= start || hour < end;
  }
}

/**
 * First instant strictly after `from` (or equal, 30-min granularity) whose
 * hour-of-day in `timezone` equals `targetHour`. Scans a 48h horizon, which is
 * cheap and only runs when a job actually lands in quiet hours.
 */
export function nextHourInTimezone(timezone: string | undefined, targetHour: number, from: Date): Date {
  const stepMs = 30 * 60 * 1000;
  const horizonMs = 48 * 60 * 60 * 1000;
  for (let t = Math.ceil(from.getTime() / stepMs) * stepMs; t <= from.getTime() + horizonMs; t += stepMs) {
    if (getHourInTimezone(timezone, new Date(t)) === targetHour) {
      return new Date(t);
    }
  }
  return new Date(from);
}

/**
 * Re-queue jobs left stuck in 'processing' (e.g. the process died mid-send)
 * so they get retried instead of silently dropped until the 7-day purge.
 */
export async function reclaimStaleProcessingJobs(): Promise<void> {
  try {
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MS);
    const result = await NotificationQueue.updateMany(
      { status: 'processing', updatedAt: { $lte: staleCutoff } },
      { $set: { status: 'pending', nextAttemptAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Worker] Reclaimed ${result.modifiedCount} stale 'processing' job(s) back to pending`);
    }
    workerStats.reclaimed += result.modifiedCount;
  } catch (err: any) {
    console.warn('[Worker] Stale-processing reclaim failed:', err.message);
  }
}

/**
 * Process a single job: check prefs, fetch tokens, send, log results.
 */
async function processJob(job: INotificationQueue): Promise<void> {
  const userId = job.userId;

  // 1. Check notification preference
  const pref = await NotificationPreference.findOne({ userId, category: job.category });
  if (pref && !pref.enabled) {
    await NotificationQueue.findByIdAndUpdate(job._id, { status: 'done' });
    console.log(`[Worker] Skipped job ${job._id} — category ${job.category} disabled for user`);
    return;
  }
  if (pref && isQuietHours(pref)) {
    // Reschedule for quiet hours end, computed in the user's timezone
    const next = nextHourInTimezone(pref.timezone, pref.quietHoursEnd, new Date());
    const safeNext = next > new Date() ? next : new Date(next.getTime() + 24 * 60 * 60 * 1000);
    await NotificationQueue.findByIdAndUpdate(job._id, {
      status: 'pending',
      nextAttemptAt: safeNext,
    });
    console.log(`[Worker] Rescheduled job ${job._id} past quiet hours to ${safeNext.toISOString()}`);
    return;
  }

  // 2. Fetch valid device tokens for user
  const tokens = await DeviceToken.find({ userId, isValid: true });
  if (tokens.length === 0) {
    await NotificationQueue.findByIdAndUpdate(job._id, { status: 'done' });
    console.log(`[Worker] No valid tokens for user ${userId}`);
    return;
  }

  // 3. Build messages
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.expoPushToken,
    title: job.title,
    body: job.body,
    data: job.data || {},
    sound: 'default',
    channelId: 'default',
  }));

  // 4. Send via Expo push API
  const results = await sendBatch(messages);

  // 5. Log results + mark invalid tokens
  let sentCount = 0;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const tokenDoc = tokens[i];

    if (result.error) {
      // Mark device token invalid if DeviceNotRegistered
      if (result.error.includes('DeviceNotRegistered') || result.error.includes('InvalidCredentials')) {
        await DeviceToken.findByIdAndUpdate(tokenDoc._id, { isValid: false });
        console.log(`[Worker] Marked token invalid: ${tokenDoc.expoPushToken}`);
      }

      // Write failed log
      await NotificationLog.create({
        userId,
        category: job.category,
        title: job.title,
        body: job.body,
        expoPushToken: tokenDoc.expoPushToken,
        status: 'failed',
        sentAt: new Date(),
      });
    } else {
      sentCount += 1;
      // Write sent log
      const log = await NotificationLog.create({
        userId,
        category: job.category,
        title: job.title,
        body: job.body,
        expoPushToken: tokenDoc.expoPushToken,
        status: 'sent',
        expoReceiptId: result.ticketId || undefined,
        sentAt: new Date(),
      });

      // Queue receipt poll
      if (result.ticketId) {
        pendingReceiptPoll.push({ receiptId: result.ticketId, logId: log._id.toString() });
      }
    }
  }

  // 6. Mark job done
  await NotificationQueue.findByIdAndUpdate(job._id, { status: 'done' });
  workerStats.sent += sentCount;
  workerStats.processed += 1;
  console.log(`[Worker] Job ${job._id} (${job.category}) done for user ${userId}`);
}

/**
 * Poll Expo receipts for previously sent notifications.
 */
async function runReceiptPoller(): Promise<void> {
  if (pendingReceiptPoll.length === 0) return;

  const batch = pendingReceiptPoll.splice(0, 300); // take up to 300
  const receiptIds = batch.map((b) => b.receiptId);
  const receipts = await pollReceipts(receiptIds);

  for (const { receiptId, logId } of batch) {
    const receipt = receipts[receiptId];
    if (!receipt) continue;

    if (receipt.status === 'ok') {
      await NotificationLog.findByIdAndUpdate(logId, { status: 'delivered' });
    } else if (receipt.status === 'error') {
      await NotificationLog.findByIdAndUpdate(logId, { status: 'failed' });
      if (receipt.details?.error === 'DeviceNotRegistered') {
        const log = await NotificationLog.findById(logId);
        if (log) {
          await DeviceToken.findOneAndUpdate(
            { expoPushToken: log.expoPushToken },
            { isValid: false }
          );
        }
      }
    }
  }
}

/**
 * Purge terminal (done/failed) jobs so the queue collection stays bounded.
 */
async function purgeTerminalJobs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - TERMINAL_JOB_RETENTION_MS);
    const result = await NotificationQueue.deleteMany({
      status: { $in: ['done', 'failed'] },
      createdAt: { $lt: cutoff },
    });
    if (result.deletedCount > 0) {
      console.log(`[Worker] Purged ${result.deletedCount} terminal jobs older than 7 days`);
    }
    workerStats.purged += result.deletedCount;
  } catch (err: any) {
    console.error('[Worker] Purge error:', err.message);
  }
}

/**
 * On worker boot, re-queue receipts from before the last restart. The in-memory
 * `pendingReceiptPoll` queue is lost on reboot, which would otherwise leave
 * delivered-but-unconfirmed notifications stuck at status 'sent' forever.
 */
async function requeueOrphanedReceipts(): Promise<void> {
  if (receiptRequeueDone) return;
  receiptRequeueDone = true;
  try {
    const cutoff = new Date(Date.now() - RECEIPT_DELAY_MS);
    const logs = await NotificationLog.find({
      status: 'sent',
      expoReceiptId: { $ne: null },
      sentAt: { $lte: cutoff },
    }).limit(300);

    for (const log of logs) {
      if (log.expoReceiptId) {
        pendingReceiptPoll.push({ receiptId: log.expoReceiptId, logId: log._id.toString() });
      }
    }
    if (logs.length > 0) {
      console.log(`[Worker] Re-queued ${logs.length} orphaned receipt(s) from before restart`);
    }
  } catch (err: any) {
    console.warn('[Worker] Receipt requeue failed:', err.message);
  }
}

/**
 * Main worker tick — pick up pending jobs from queue.
 * Returns the number of jobs still queued so the scheduler can back off when idle.
 */
async function runWorkerTick(): Promise<number> {
  workerStats.ticks += 1;
  workerStats.lastTickAt = Date.now();
  try {
    await requeueOrphanedReceipts();
    await reclaimStaleProcessingJobs();

    const jobs = await NotificationQueue.find({
      status: 'pending',
      nextAttemptAt: { $lte: new Date() },
    })
      .limit(10)
      .sort({ createdAt: 1 });

    for (const job of jobs) {
      // Mark processing to prevent double-processing
      const claimed = await NotificationQueue.findOneAndUpdate(
        { _id: job._id, status: 'pending' },
        { status: 'processing', $inc: { attempts: 1 } },
        { new: true }
      );
      if (!claimed) continue; // another process got it first

      try {
        await processJob(claimed);
      } catch (err: any) {
        console.error(`[Worker] Error processing job ${job._id}:`, err.message);
        workerStats.failed += 1;
        const backoffMs = Math.min(60_000 * claimed.attempts, 300_000); // max 5 min backoff
        const nextAttempt = new Date(Date.now() + backoffMs);

        if (claimed.attempts >= claimed.maxAttempts) {
          await NotificationQueue.findByIdAndUpdate(job._id, { status: 'failed' });
        } else {
          await NotificationQueue.findByIdAndUpdate(job._id, {
            status: 'pending',
            nextAttemptAt: nextAttempt,
          });
        }
      }
    }

    // Run receipt polling in same tick
    await runReceiptPoller();

    // Bounded bookkeeping once per tick (at most every 10s when busy)
    await purgeTerminalJobs();

    const stillQueued = await NotificationQueue.countDocuments({
      status: { $in: ['pending', 'processing'] },
      nextAttemptAt: { $lte: new Date() },
    });
    return stillQueued;
  } catch (err: any) {
    console.error('[Worker] Tick error:', err.message);
    return 0;
  }
}

/**
 * Self-scheduling loop — poll fast while jobs are pending, back off when idle.
 */
function scheduleNextTick(delayMs: number): void {
  workerTimer = setTimeout(async () => {
    const stillQueued = await runWorkerTick();
    const delay = stillQueued > 0 ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
    scheduleNextTick(delay);
  }, delayMs);
}

/**
 * Start the notification worker. Call once on server boot.
 */
export function startNotificationWorker(): void {
  if (workerRunning) return;
  workerRunning = true;
  console.log('[Worker] Notification worker started (active: 10s, idle: 60s)');
  scheduleNextTick(ACTIVE_POLL_INTERVAL_MS);
}

/**
 * Stop the notification worker (used in tests / graceful shutdown).
 */
export function stopNotificationWorker(): void {
  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }
  workerRunning = false;
}

/**
 * Enqueue a push notification job.
 */
export async function enqueueNotification(
  userId: mongoose.Types.ObjectId | string,
  category: INotificationQueue['category'],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  await NotificationQueue.create({
    userId,
    category,
    title,
    body,
    data,
    status: 'pending',
    nextAttemptAt: new Date(),
  });
}

/**
 * Bulk-enqueue many pending jobs in a single write. Used by the nightly
 * inactivity scan / weekly summary crons, which would otherwise do one
 * sequential DB insert per user.
 */
export async function enqueueNotifications(
  items: Array<{
    userId: mongoose.Types.ObjectId | string;
    category: INotificationQueue['category'];
    title: string;
    body: string;
    data?: Record<string, any>;
  }>
): Promise<void> {
  if (items.length === 0) return;
  await NotificationQueue.insertMany(
    items.map((item) => ({
      userId: item.userId,
      category: item.category,
      title: item.title,
      body: item.body,
      data: item.data || {},
      status: 'pending',
      nextAttemptAt: new Date(),
    }))
  );
}
