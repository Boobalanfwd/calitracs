import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

vi.mock('../src/models/FoodLog', () => {
  const FoodLog: any = vi.fn();
  FoodLog.findOne = vi.fn();
  FoodLog.find = vi.fn();
  FoodLog.create = vi.fn();
  FoodLog.mockImplementation((init: any = {}) => ({
    ...init,
    save: vi.fn().mockResolvedValue(true),
  }));
  return { FoodLog, MealType: 'meal' };
});

vi.mock('../src/models/DailyTarget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/models/DailyTarget')>();
  return { ...actual, DailyTarget: { findOne: vi.fn(), find: vi.fn(), create: vi.fn() } };
});

vi.mock('../src/services/notificationOrchestrator', () => ({
  onCaloriesGoalHit: vi.fn(),
}));

import { FoodLog } from '../src/models/FoodLog';
import { DailyTarget } from '../src/models/DailyTarget';
import { onCaloriesGoalHit } from '../src/services/notificationOrchestrator';
import { getLog, addEntry, deleteEntry, getCalendarMonth, updateWaterIntake, getWeeklyWater, deleteWaterEntry } from '../src/controllers/logsController';

const mockedFoodLog = vi.mocked(FoodLog);
const mockedTarget = vi.mocked(DailyTarget);
const mockedGoal = vi.mocked(onCaloriesGoalHit);

const USER_ID = '507f1f77bcf86cd799439011';

function makeReq(body: any = {}, user: any = null, params: any = {}, query: any = {}) {
  return { body, user, params, query } as unknown as Request;
}

function makeRes() {
  let statusCode: number | null = null;
  let body: any = null;
  const res = {
    status(c: number) {
      statusCode = c;
      return { json: (b: any) => { body = b; } };
    },
    json: (b: any) => { if (statusCode === null) statusCode = 200; body = b; },
  } as unknown as Response;
  return {
    res,
    get status() { return statusCode; },
    get body() { return body; },
  };
}

function makeLog(overrides: Record<string, any> = {}) {
  return {
    userId: USER_ID,
    date: '2025-01-01',
    entries: [],
    waterIntakeMl: 0,
    waterLogs: [],
    totalCalories: 0,
    totalProteinG: 0,
    totalCarbsG: 0,
    totalFatG: 0,
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const validEntry = {
  name: 'Banana',
  meal: 'breakfast',
  calories: 100,
  proteinG: 1,
  carbsG: 20,
  fatG: 0.5,
};

const validReq = () => makeReq({ ...validEntry, date: '2025-01-01' }, { userId: USER_ID });

beforeEach(() => {
  mockedFoodLog.findOne.mockReset();
  mockedFoodLog.find.mockReset();
  mockedFoodLog.create.mockReset();
  mockedFoodLog.mockClear();
  mockedTarget.findOne.mockReset();
  mockedTarget.findOne.mockResolvedValue(null);
  mockedTarget.find.mockReset();
  mockedGoal.mockReset();
});

describe('getLog', () => {
  it('rejects an invalid date', async () => {
    const result = makeRes();
    await getLog(makeReq({}, { userId: USER_ID }, { date: '2025-02-31' }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Invalid date');
  });

  it('returns defaults when there is no log or target', async () => {
    mockedFoodLog.findOne.mockResolvedValue(null);
    mockedTarget.findOne.mockResolvedValue(null);
    const result = makeRes();
    await getLog(makeReq({}, { userId: USER_ID }, { date: '2025-01-01' }), result.res);
    expect(result.status).toBe(200);
    expect(result.body.log.entries).toEqual([]);
    expect(result.body.log.totalCalories).toBe(0);
    expect(result.body.targets.calories).toBe(2000);
  });

  it('returns the stored log and target', async () => {
    const log = makeLog({ totalCalories: 550, entries: [{}] });
    mockedFoodLog.findOne.mockResolvedValue(log);
    mockedTarget.findOne.mockResolvedValue({ calories: 2200 });
    const result = makeRes();
    await getLog(makeReq({}, { userId: USER_ID }, { date: 'today' }), result.res);
    expect(result.status).toBe(200);
    expect(result.body.log.totalCalories).toBe(550);
    expect(result.body.targets.calories).toBe(2200);
  });
});

describe('addEntry', () => {
  it('rejects a missing or non-string name', async () => {
    for (const name of [undefined, '', '   ', 42]) {
      const result = makeRes();
      await addEntry(validReqWith({ name }), result.res);
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Food name is required.');
    }
  });

  it('rejects a name longer than the limit', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ name: 'a'.repeat(201) }), result.res);
    expect(result.status).toBe(400);
  });

  it('rejects non-finite calories', async () => {
    for (const calories of [NaN, Infinity, '100', null]) {
      const result = makeRes();
      await addEntry(validReqWith({ calories }), result.res);
      expect(result.status).toBe(400);
      expect(result.body.error).toContain('Calories must be a number');
    }
  });

  it('rejects calories outside the allowed range', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ calories: 100_001 }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Calories must be a number between 0 and 100000');
  });

  it('rejects out-of-range macros', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ proteinG: 50_000 }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Protein, carbs, and fat');
  });

  it('rejects NaN macros', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ carbsG: NaN }), result.res);
    expect(result.status).toBe(400);
  });

  it('rejects an out-of-range weight', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ weightGramsOrMl: -5 }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Weight must be a number');
  });

  it('rejects an invalid source', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ source: 'gemini' }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('source must be "ai" or "manual".');
  });

  it('rejects an invalid nutritionSource', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ nutritionSource: 'bogus' }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('nutritionSource must be one of');
  });

  it('rejects an invalid meal', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ meal: 'brunch' }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Invalid meal');
  });

  it('rejects an impossible date', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ date: '2024-02-30' }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Invalid date');
  });

  it('rejects a portion quantity below the minimum', async () => {
    const result = makeRes();
    await addEntry(validReqWith({ portionQuantity: 0.05 }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Portion quantity must be a number');
  });

  it('rejects adding beyond the daily entry cap', async () => {
    const log = makeLog();
    log.entries = new Array(200).fill({ _id: new mongoose.Types.ObjectId() });
    mockedFoodLog.findOne.mockResolvedValue(log);
    const result = makeRes();
    await addEntry(validReq(), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('daily entry limit');
  });

  it('creates a new log and adds the entry on success', async () => {
    mockedFoodLog.findOne.mockResolvedValue(null);
    const createdLog = makeLog({ date: '2025-01-01', entries: [] });
    mockedFoodLog.create.mockResolvedValue(createdLog);
    mockedTarget.findOne.mockResolvedValue({ calories: 2000 });

    const result = makeRes();
    await addEntry(validReqWith({ name: '  Banana  ', calories: 100.6 }), result.res);

    expect(mockedFoodLog.create).toHaveBeenCalledTimes(1);
    const createArgs = (mockedFoodLog.create.mock.calls[0] as any)[0];
    const entry = createArgs.entries[0];
    expect(entry.name).toBe('Banana');      // trimmed
    expect(entry.calories).toBe(101);       // rounded
    expect(entry.meal).toBe('breakfast');
    expect(entry.source).toBe('manual');
    expect(entry.nutritionSource).toBe('manual');
    expect(result.status).toBe(201);
    expect(result.body.success).toBe(true);
    expect(result.body.log).toBe(createdLog);
  });

  it('appends to an existing log when present', async () => {
    const existing = makeLog({ date: '2025-01-01', entries: [] });
    mockedFoodLog.findOne.mockResolvedValue(existing);
    const result = makeRes();
    await addEntry(validReq(), result.res);
    expect(mockedFoodLog.create).not.toHaveBeenCalled();
    expect(existing.entries).toHaveLength(1);
    expect(existing.save).toHaveBeenCalled();
    expect(result.status).toBe(201);
  });
});

describe('deleteEntry', () => {
  it('rejects an invalid date query param', async () => {
    const result = makeRes();
    await deleteEntry(makeReq({}, { userId: USER_ID }, { entryId: 'e1' }, { date: 'nope' }), result.res);
    expect(result.status).toBe(400);
  });

  it('404s when the log does not exist', async () => {
    mockedFoodLog.findOne.mockResolvedValue(null);
    const result = makeRes();
    await deleteEntry(makeReq({}, { userId: USER_ID }, { entryId: 'e1' }, { date: '2025-01-01' }), result.res);
    expect(result.status).toBe(404);
    expect(result.body.error).toBe('Log not found for this date.');
  });

  it('404s when the entry is not found', async () => {
    mockedFoodLog.findOne.mockResolvedValue(makeLog({ entries: [{ _id: new mongoose.Types.ObjectId() }] }));
    const result = makeRes();
    await deleteEntry(makeReq({}, { userId: USER_ID }, { entryId: 'does-not-exist' }, { date: '2025-01-01' }), result.res);
    expect(result.status).toBe(404);
    expect(result.body.error).toBe('Entry not found.');
  });

  it('removes the matching entry', async () => {
    const targetId = new mongoose.Types.ObjectId().toString();
    const log = makeLog({ entries: [{ _id: targetId } as any] });
    mockedFoodLog.findOne.mockResolvedValue(log);
    const result = makeRes();
    await deleteEntry(makeReq({}, { userId: USER_ID }, { entryId: targetId }, { date: '2025-01-01' }), result.res);
    expect(log.entries).toHaveLength(0);
    expect(log.save).toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });
});

describe('getCalendarMonth', () => {
  it('rejects invalid year or month', async () => {
    for (const [year, month] of [['1999', '1'], ['2025', '13'], ['abc', '1']]) {
      const result = makeRes();
      await getCalendarMonth(makeReq({}, { userId: USER_ID }, { year, month }), result.res);
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Invalid year or month.');
    }
  });

  it('returns day summaries with target percentage', async () => {
    mockedFoodLog.find.mockReturnValue({ select: () => Promise.resolve([
      { date: '2025-01-15', totalCalories: 1000, totalProteinG: 50, totalCarbsG: 100, totalFatG: 20 },
    ]) } as any);
    mockedTarget.findOne.mockResolvedValue({ calories: 2000 });
    const result = makeRes();
    await getCalendarMonth(makeReq({}, { userId: USER_ID }, { year: '2025', month: '1' }), result.res);
    expect(result.status).toBe(200);
    expect(result.body.targetCalories).toBe(2000);
    expect(result.body.days[0].percentage).toBe(50);
  });
});

describe('updateWaterIntake', () => {
  it('rejects an invalid date', async () => {
    const result = makeRes();
    await updateWaterIntake(makeReq({ date: 'bad', amountMl: 500 }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(400);
  });

  it('rejects an invalid mode', async () => {
    const result = makeRes();
    await updateWaterIntake(makeReq({ amountMl: 500, mode: 'clear' }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('mode must be "add" or "set".');
  });

  it('rejects a non-finite amount', async () => {
    for (const amountMl of [NaN, Infinity, 100_001, -1]) {
      const result = makeRes();
      await updateWaterIntake(makeReq({ amountMl }, { userId: USER_ID }), result.res);
      expect(result.status).toBe(400);
      expect(result.body.error).toContain('Valid water amount in ml');
    }
  });

  it('rejects adding less than 1 ml', async () => {
    mockedFoodLog.findOne.mockResolvedValue(makeLog());
    const result = makeRes();
    await updateWaterIntake(makeReq({ amountMl: 0, mode: 'add' }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Water amount must be at least 1 ml.');
  });

  it('appends and recomputes the total in add mode', async () => {
    const log = makeLog({ waterLogs: [{ amountMl: 250 }] });
    mockedFoodLog.findOne.mockResolvedValue(log);
    const result = makeRes();
    await updateWaterIntake(makeReq({ amountMl: 350, mode: 'add' }, { userId: USER_ID }), result.res);
    expect(log.waterLogs).toHaveLength(2);
    expect(log.waterIntakeMl).toBe(600);
    expect(log.save).toHaveBeenCalled();
    expect(result.status).toBe(200);
  });

  it('replaces the total in set mode', async () => {
    const log = makeLog({ waterLogs: [{ amountMl: 250 }] });
    mockedFoodLog.findOne.mockResolvedValue(log);
    const result = makeRes();
    await updateWaterIntake(makeReq({ amountMl: 2000, mode: 'set' }, { userId: USER_ID }), result.res);
    expect(log.waterIntakeMl).toBe(2000);
    expect(log.waterLogs).toHaveLength(1);
    expect(result.status).toBe(200);
  });

  it('clears water logs when set to 0', async () => {
    const log = makeLog({ waterLogs: [{ amountMl: 250 }] });
    mockedFoodLog.findOne.mockResolvedValue(log);
    const result = makeRes();
    await updateWaterIntake(makeReq({ amountMl: 0, mode: 'set' }, { userId: USER_ID }), result.res);
    expect(log.waterIntakeMl).toBe(0);
    expect(log.waterLogs).toEqual([]);
  });
});

describe('getWeeklyWater', () => {
  it('rejects an invalid startDate', async () => {
    const result = makeRes();
    await getWeeklyWater(makeReq({}, { userId: USER_ID }, {}, { startDate: '2025-99-99' }), result.res);
    expect(result.status).toBe(400);
  });

  it('merges DB water values into the 7-day window', async () => {
    const day = new Date('2025-01-06T00:00:00Z'); // a Monday
    mockedFoodLog.find.mockReturnValue({ select: () => Promise.resolve([
      { date: '2025-01-06', waterIntakeMl: 1500 },
      { date: '2025-01-08', waterIntakeMl: 2500 },
    ]) } as any);
    mockedTarget.findOne.mockResolvedValue({ waterMl: 2000 });

    const req = makeReq({}, { userId: USER_ID }, {}, { startDate: day.toISOString().slice(0, 10) });
    const result = makeRes();
    await getWeeklyWater(req, result.res);

    expect(result.status).toBe(200);
    expect(result.body.days).toHaveLength(7);
    expect(result.body.days[0].waterMl).toBe(1500);
    expect(result.body.days[2].waterMl).toBe(2500);
    expect(result.body.targetWaterMl).toBe(2000);
  });
});

describe('deleteWaterEntry', () => {
  it('404s when the log is missing', async () => {
    mockedFoodLog.findOne.mockResolvedValue(null);
    const result = makeRes();
    await deleteWaterEntry(makeReq({}, { userId: USER_ID }, { waterId: 'w1' }, { date: '2025-01-01' }), result.res);
    expect(result.status).toBe(404);
  });

  it('removes a water entry and recomputes the total', async () => {
    const wId = new mongoose.Types.ObjectId().toString();
    const log = makeLog({ waterLogs: [{ _id: wId, amountMl: 500 }, { _id: new mongoose.Types.ObjectId().toString(), amountMl: 300 }] });
    mockedFoodLog.findOne.mockResolvedValue(log);
    const result = makeRes();
    await deleteWaterEntry(makeReq({}, { userId: USER_ID }, { waterId: wId }, { date: '2025-01-01' }), result.res);
    expect(log.waterLogs).toHaveLength(1);
    expect(log.waterIntakeMl).toBe(300);
    expect(log.save).toHaveBeenCalled();
    expect(result.status).toBe(200);
  });
});

// helper that merges overrides into a valid entry payload
function validReqWith(overrides: Record<string, any>) {
  return makeReq({ ...validEntry, date: '2025-01-01', ...overrides }, { userId: USER_ID });
}
