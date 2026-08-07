import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../models/DailyTarget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../models/DailyTarget')>();
  return { ...actual, DailyTarget: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() } };
});

vi.mock('../models/User', () => ({
  User: { findById: vi.fn() },
}));

import { DailyTarget } from '../models/DailyTarget';
import { User } from '../models/User';
import { getTargets, updateTargets, getSuggestedTargets } from './targetsController';

const mockedTarget = vi.mocked(DailyTarget);
const mockedUser = vi.mocked(User);

const USER_ID = '507f1f77bcf86cd799439011';

function makeReq(body: any = {}, user: any = null) {
  return { body, user } as unknown as Request;
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

beforeEach(() => {
  mockedTarget.findOne.mockReset();
  mockedTarget.findOneAndUpdate.mockReset();
  mockedUser.findById.mockReset();
});

describe('getTargets', () => {
  it('404s when no targets exist', async () => {
    mockedTarget.findOne.mockResolvedValue(null);
    const result = makeRes();
    await getTargets(makeReq({}, { userId: USER_ID }), result.res);
    expect(result.status).toBe(404);
    expect(result.body.error).toBe('No targets found. Please complete onboarding.');
  });

  it('returns the stored targets', async () => {
    mockedTarget.findOne.mockResolvedValue({ calories: 2100, proteinG: 140 });
    const result = makeRes();
    await getTargets(makeReq({}, { userId: USER_ID }), result.res);
    expect(result.status).toBe(200);
    expect(result.body.targets.calories).toBe(2100);
  });
});

describe('updateTargets', () => {
  it('rejects invalid target values', async () => {
    const bad = [
      { calories: 100, proteinG: 10, carbsG: 10, fatG: 10 },
      { calories: '2000', proteinG: 10, carbsG: 10, fatG: 10 },
      { calories: 2000, proteinG: -1, carbsG: 10, fatG: 10 },
      { calories: 2000, proteinG: 10, carbsG: 10, fatG: 10, waterMl: 200 },
      { calories: 2000, proteinG: 10, carbsG: 10, fatG: 10, waterMl: 99999 },
    ];
    for (const body of bad) {
      const result = makeRes();
      await updateTargets(makeReq(body, { userId: USER_ID }), result.res);
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Invalid target values.');
    }
  });

  it('upserts the targets on success', async () => {
    const saved = { calories: 2000, proteinG: 150, carbsG: 225, fatG: 65 };
    mockedTarget.findOneAndUpdate.mockResolvedValue(saved);
    const result = makeRes();
    await updateTargets(makeReq({ calories: 2000, proteinG: 150, carbsG: 225, fatG: 65 }, { userId: USER_ID }), result.res);
    expect(mockedTarget.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: USER_ID },
      { calories: 2000, proteinG: 150, carbsG: 225, fatG: 65 },
      { new: true, upsert: true }
    );
    expect(result.status).toBe(200);
    expect(result.body.targets).toBe(saved);
  });

  it('includes waterMl when provided', async () => {
    mockedTarget.findOneAndUpdate.mockResolvedValue({});
    const result = makeRes();
    await updateTargets(makeReq({ calories: 2000, proteinG: 150, carbsG: 225, fatG: 65, waterMl: 2500 }, { userId: USER_ID }), result.res);
    const [, fields] = mockedTarget.findOneAndUpdate.mock.calls[0] as [any, any];
    expect(fields.waterMl).toBe(2500);
  });
});

describe('getSuggestedTargets', () => {
  it('400s when the profile is incomplete', async () => {
    mockedUser.findById.mockResolvedValue({ profile: { age: 30 } });
    const result = makeRes();
    await getSuggestedTargets(makeReq({}, { userId: USER_ID }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Profile incomplete');
  });

  it('404s when the user does not exist', async () => {
    mockedUser.findById.mockResolvedValue(null);
    const result = makeRes();
    await getSuggestedTargets(makeReq({}, { userId: USER_ID }), result.res);
    expect(result.status).toBe(404);
  });

  it('returns calculated targets for a complete profile', async () => {
    mockedUser.findById.mockResolvedValue({
      profile: { age: 30, weightKg: 70, heightCm: 170, activityLevel: 'moderate', goal: 'lose', gender: 'male' },
    });
    const result = makeRes();
    await getSuggestedTargets(makeReq({}, { userId: USER_ID }), result.res);
    expect(result.status).toBe(200);
    expect(result.body.suggested.calories).toBeGreaterThan(0);
    expect(result.body.suggested.waterMl).toBeGreaterThanOrEqual(2000);
  });
});
