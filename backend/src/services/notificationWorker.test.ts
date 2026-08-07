import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/DeviceToken', () => ({ DeviceToken: { find: vi.fn(), findByIdAndUpdate: vi.fn(), findOneAndUpdate: vi.fn() } }));
vi.mock('../models/NotificationPreference', () => ({ NotificationPreference: { findOne: vi.fn() } }));
vi.mock('../models/NotificationQueue', () => ({ NotificationQueue: { find: vi.fn(), findOneAndUpdate: vi.fn(), findByIdAndUpdate: vi.fn(), updateMany: vi.fn(), create: vi.fn(), insertMany: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('../models/NotificationLog', () => ({ NotificationLog: { create: vi.fn(), findByIdAndUpdate: vi.fn(), findById: vi.fn(), find: vi.fn() } }));
vi.mock('./expoPushService', () => ({ sendBatch: vi.fn(), pollReceipts: vi.fn(), ExpoPushMessage: {} }));

import { NotificationQueue } from '../models/NotificationQueue';
import { getHourInTimezone, isQuietHours, nextHourInTimezone, reclaimStaleProcessingJobs, enqueueNotification, enqueueNotifications, getWorkerStats, resetWorkerStats } from './notificationWorker';

const mockedQueue = vi.mocked(NotificationQueue);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('getHourInTimezone', () => {
  it('converts a UTC instant to the hour in a non-UTC timezone', () => {
    // 2025-01-01 12:00 UTC = 17:30 in Kolkata (UTC+5:30)
    expect(getHourInTimezone('Asia/Kolkata', new Date('2025-01-01T12:00:00Z'))).toBe(17);
    // 2025-01-15 10:00 UTC = 05:00 in New York (UTC-5)
    expect(getHourInTimezone('America/New_York', new Date('2025-01-15T10:00:00Z'))).toBe(5);
  });

  it('defaults to UTC when no timezone given', () => {
    expect(getHourInTimezone(undefined, new Date('2025-01-01T08:30:00Z'))).toBe(8);
  });

  it('falls back to UTC hour on an invalid timezone', () => {
    expect(getHourInTimezone('Mars/Olympus', new Date('2025-01-01T08:30:00Z'))).toBe(8);
  });

  it('normalizes a 24:00 hour to 0', () => {
    // Midnight in Kolkata is 2025-01-01T18:30:00Z
    expect(getHourInTimezone('Asia/Kolkata', new Date('2025-01-01T18:30:00Z'))).toBe(0);
  });
});

describe('isQuietHours', () => {
  it('evaluates in the user timezone, not the server (UTC) timezone', () => {
    const now = new Date('2025-01-15T10:00:00Z'); // 05:00 in NY, 10:00 UTC
    const pref = { quietHoursStart: 22, quietHoursEnd: 7, timezone: 'America/New_York' };
    expect(isQuietHours(pref, now)).toBe(true); // quiet in NY, but NOT quiet in UTC
  });

  it('returns false outside quiet hours', () => {
    const now = new Date('2025-01-15T15:00:00Z'); // 10:00 in NY
    expect(isQuietHours({ quietHoursStart: 22, quietHoursEnd: 7, timezone: 'America/New_York' }, now)).toBe(false);
  });

  it('handles non-midnight-crossing windows (01:00–06:00)', () => {
    const inside = new Date('2025-01-15T10:00:00Z'); // NY 05:00
    const outside = new Date('2025-01-15T14:00:00Z'); // NY 09:00
    const pref = { quietHoursStart: 1, quietHoursEnd: 6, timezone: 'America/New_York' };
    expect(isQuietHours(pref, inside)).toBe(true);
    expect(isQuietHours(pref, outside)).toBe(false);
  });

  it('treats the end hour as exclusive', () => {
    // NY 07:00 = 12:00Z; window 22:00–07:00 should END at 07:00
    const atEnd = new Date('2025-01-15T12:00:00Z');
    expect(isQuietHours({ quietHoursStart: 22, quietHoursEnd: 7, timezone: 'America/New_York' }, atEnd)).toBe(false);
  });
});

describe('nextHourInTimezone', () => {
  it('finds the next occurrence of an hour in the user timezone', () => {
    const from = new Date('2025-01-15T10:00:00Z'); // NY 05:00, inside quiet hours
    const next = nextHourInTimezone('America/New_York', 7, from); // quiet ends 07:00 NY = 12:00Z
    expect(next.toISOString()).toBe('2025-01-15T12:00:00.000Z');
  });

  it('returns a time at or after `from` when already at the target hour', () => {
    const from = new Date('2025-01-15T12:00:00Z'); // exactly NY 07:00
    const next = nextHourInTimezone('America/New_York', 7, from);
    expect(next.getTime()).toBeGreaterThanOrEqual(from.getTime());
  });
});

describe('reclaimStaleProcessingJobs', () => {
  beforeEach(() => resetWorkerStats());

  it('re-queues jobs stuck in processing past the stale cutoff', async () => {
    mockedQueue.updateMany.mockResolvedValue({ modifiedCount: 3 } as any);
    await reclaimStaleProcessingJobs();
    expect(mockedQueue.updateMany).toHaveBeenCalledTimes(1);
    const [filter, update] = mockedQueue.updateMany.mock.calls[0] as [any, any];
    expect(filter.status).toBe('processing');
    expect(filter.updatedAt.$lte).toBeInstanceOf(Date);
    expect(update.$set.status).toBe('pending');
    expect(update.$set.nextAttemptAt).toBeInstanceOf(Date);
    expect(getWorkerStats().reclaimed).toBe(3);
  });

  it('does not log when there is nothing to reclaim', async () => {
    mockedQueue.updateMany.mockResolvedValue({ modifiedCount: 0 } as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await reclaimStaleProcessingJobs();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('swallows DB errors without throwing', async () => {
    mockedQueue.updateMany.mockRejectedValue(new Error('db down'));
    await expect(reclaimStaleProcessingJobs()).resolves.toBeUndefined();
  });
});

describe('enqueueNotification', () => {
  it('creates a pending job with an immediate nextAttemptAt', async () => {
    mockedQueue.create.mockResolvedValue({});
    await enqueueNotification('507f1f77bcf86cd799439011', 'water_reminder', 'Drink water', 'Time to hydrate!', { goal: 2000 });
    expect(mockedQueue.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: '507f1f77bcf86cd799439011',
      category: 'water_reminder',
      title: 'Drink water',
      body: 'Time to hydrate!',
      data: { goal: 2000 },
      status: 'pending',
      nextAttemptAt: expect.any(Date),
    }));
  });
});

describe('enqueueNotifications', () => {
  it('inserts all jobs in a single insertMany write', async () => {
    mockedQueue.insertMany.mockResolvedValue([]);
    await enqueueNotifications([
      { userId: 'a', category: 'inactivity', title: 'T1', body: 'B1' },
      { userId: 'b', category: 'inactivity', title: 'T2', body: 'B2', data: { screen: 'log' } },
    ]);
    expect(mockedQueue.insertMany).toHaveBeenCalledTimes(1);
    const docs = mockedQueue.insertMany.mock.calls[0][0] as any[];
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ userId: 'a', status: 'pending', data: {} });
    expect(docs[0].nextAttemptAt).toBeInstanceOf(Date);
    expect(docs[1]).toMatchObject({ userId: 'b', data: { screen: 'log' } });
  });

  it('skips the write entirely for an empty list', async () => {
    await enqueueNotifications([]);
    expect(mockedQueue.insertMany).not.toHaveBeenCalled();
  });
});

describe('workerStats', () => {
  it('reports zeroed counters by default', () => {
    resetWorkerStats();
    expect(getWorkerStats()).toMatchObject({
      ticks: 0,
      processed: 0,
      failed: 0,
      sent: 0,
      reclaimed: 0,
      purged: 0,
    });
  });

  it('resetWorkerStats clears accumulated counters', async () => {
    resetWorkerStats();
    mockedQueue.updateMany.mockResolvedValue({ modifiedCount: 2 } as any);
    await reclaimStaleProcessingJobs();
    expect(getWorkerStats().reclaimed).toBe(2);
    resetWorkerStats();
    expect(getWorkerStats().reclaimed).toBe(0);
  });
});
