import mongoose from 'mongoose';
import { User } from '../models/User';

const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

let isConnected = false;
let retryTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0;
let legacyBackfillDone = false;

export const isDBConnected = (): boolean => isConnected;

export const getDBStatus = (): { connected: boolean; readyState: number; retryAttempts: number } => ({
  connected: isConnected,
  readyState: mongoose.connection.readyState,
  retryAttempts: retryAttempt,
});

/**
 * One-time, idempotent backfill: users created before the `tokenVersion` field
 * existed carry no field at all. Normalize them to 0 so session checks compare
 * a real number (the middleware also tolerates undefined, but clean data avoids
 * surprises anywhere else that reads tokenVersion).
 */
const backfillLegacyTokenVersions = async (): Promise<void> => {
  if (legacyBackfillDone) return;
  legacyBackfillDone = true;
  try {
    const result = await User.updateMany(
      { tokenVersion: { $exists: false } },
      { $set: { tokenVersion: 0 } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[DB] Backfilled tokenVersion=0 for ${result.modifiedCount} legacy user(s)`);
    }
  } catch (err) {
    legacyBackfillDone = false;
    console.warn('[DB] tokenVersion backfill failed:', (err as Error).message);
  }
};

const setConnected = (): void => {
  isConnected = true;
  retryAttempt = 0;
};

const setDisconnected = (): void => {
  isConnected = false;
};

const scheduleRetry = (uri: string): void => {
  if (retryTimer) return;
  const delay = Math.min(RETRY_BASE_MS * Math.pow(2, retryAttempt), RETRY_MAX_MS);
  retryAttempt += 1;
  console.warn(
    `[DB] Connection failed — retrying in ${Math.round(delay / 1000)}s (attempt ${retryAttempt}).`
  );
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    try {
      await mongoose.connect(uri);
      setConnected();
      console.log('✅ MongoDB connected (after retry)');
      await backfillLegacyTokenVersions();
    } catch (err) {
      console.warn('[DB] Retry failed:', (err as Error).message);
      scheduleRetry(uri);
    }
  }, delay);
};

/**
 * Connect to MongoDB. Unlike a hard fail, we keep the server bootable and retry
 * in the background with exponential backoff — a transient Atlas/Render cold-start
 * latency blip no longer leaves the app DB-less forever.
 */
export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/foodlens';

  // Keep the in-memory flag in sync with real connection state so downstream
  // checks (e.g. whether to persist FoodAnalysis) aren't stale.
  mongoose.connection.on('connected', setConnected);
  mongoose.connection.on('reconnected', setConnected);
  mongoose.connection.on('disconnected', setDisconnected);
  mongoose.connection.on('error', (err) => {
    console.error('[DB] Mongoose error:', (err as Error).message);
  });

  try {
    await mongoose.connect(uri);
    setConnected();
    console.log('✅ MongoDB connected');
    await backfillLegacyTokenVersions();
  } catch (error) {
    setDisconnected();
    console.warn(
      '⚠️  MongoDB connection failed — server will start without DB.',
      '\n   Food analysis will still work but results won\'t be saved.',
      '\n   Error:', (error as Error).message
    );
    // Do NOT throw — retry in the background instead.
    scheduleRetry(uri);
  }
};

/** Close the DB connection and cancel any pending reconnect (graceful shutdown). */
export const disconnectDB = async (): Promise<void> => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  await mongoose.disconnect();
  isConnected = false;
};
