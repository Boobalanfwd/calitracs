import { DeviceToken } from '../models/DeviceToken';
import { NotificationPreference } from '../models/NotificationPreference';
import { NotificationQueue, INotificationQueue } from '../models/NotificationQueue';
import { NotificationLog } from '../models/NotificationLog';
import { sendBatch, pollReceipts, ExpoPushMessage } from './expoPushService';
import mongoose from 'mongoose';

const POLL_INTERVAL_MS = 10_000;   // process queue every 10 seconds
const RECEIPT_DELAY_MS = 30_000;   // poll receipts 30s after sending
let workerRunning = false;
const pendingReceiptPoll: Array<{ receiptId: string; logId: string }> = [];

/**
 * Check if current time is within quiet hours for a given preference.
 */
function isQuietHours(pref: { quietHoursStart: number; quietHoursEnd: number }): boolean {
  const hour = new Date().getHours();
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
    // Reschedule for quiet hours end
    const rescheduleHour = pref.quietHoursEnd;
    const next = new Date();
    next.setHours(rescheduleHour, 0, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    await NotificationQueue.findByIdAndUpdate(job._id, {
      status: 'pending',
      nextAttemptAt: next,
    });
    console.log(`[Worker] Rescheduled job ${job._id} past quiet hours to ${next.toISOString()}`);
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
 * Main worker loop — pick up pending jobs from queue.
 */
async function runWorkerTick(): Promise<void> {
  try {
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
  } catch (err: any) {
    console.error('[Worker] Tick error:', err.message);
  }
}

/**
 * Start the notification worker. Call once on server boot.
 */
export function startNotificationWorker(): void {
  if (workerRunning) return;
  workerRunning = true;
  console.log('[Worker] Notification worker started (polling every 10s)');
  setInterval(runWorkerTick, POLL_INTERVAL_MS);
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
