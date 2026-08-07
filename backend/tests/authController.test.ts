import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../src/models/User', () => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/models/DailyTarget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/models/DailyTarget')>();
  return {
    ...actual,
    DailyTarget: {
      create: vi.fn(),
      findOneAndUpdate: vi.fn(),
    },
  };
});

vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: vi.fn(), compare: vi.fn() },
}));

vi.mock('../src/middlewares/auth', () => ({
  signToken: vi.fn(),
  invalidateTokenVersionCache: vi.fn(),
}));

import { User } from '../src/models/User';
import { DailyTarget } from '../src/models/DailyTarget';
import bcrypt from 'bcryptjs';
import { signToken } from '../src/middlewares/auth';
import { register, login, getMe, updateProfile, convertGuest, guestLogin } from '../src/controllers/authController';

const mockedUser = vi.mocked(User, true);
const mockedTarget = vi.mocked(DailyTarget, true);
const mockedBcrypt = vi.mocked(bcrypt);
const mockedSignToken = vi.mocked(signToken);

const USER_ID = '507f1f77bcf86cd799439011';
const EMAIL = 'test@example.com';

function makeUser(overrides: Record<string, any> = {}) {
  return {
    _id: USER_ID,
    name: 'Test User',
    email: EMAIL,
    passwordHash: 'hashed-password',
    isGuest: false,
    onboardingComplete: true,
    tokenVersion: 0,
    profile: { age: 30, weightKg: 70, heightCm: 170, activityLevel: 'moderate', goal: 'maintain', gender: 'male' },
    save: vi.fn().mockResolvedValue(true),
    toObject: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

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
  mockedUser.findOne.mockReset();
  mockedUser.findById.mockReset();
  mockedUser.findByIdAndUpdate.mockReset();
  mockedUser.create.mockReset();
  mockedTarget.create.mockReset();
  mockedTarget.findOneAndUpdate.mockReset();
  mockedBcrypt.hash.mockReset();
  mockedBcrypt.compare.mockReset();
  mockedSignToken.mockReset();
  mockedSignToken.mockImplementation((p: any) => `signed-${p.tokenVersion}`);
});

describe('register', () => {
  it('rejects missing required fields', async () => {
    for (const body of [{ name: 'x', email: EMAIL }, { name: 'x', password: 'secret1' }, { email: EMAIL, password: 'secret1' }]) {
      const result = makeRes();
      await register(makeReq(body), result.res);
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Name, email, and password are required.');
    }
  });

  it('rejects a short password', async () => {
    const result = makeRes();
    await register(makeReq({ name: 'x', email: EMAIL, password: '123' }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Password must be at least 6 characters.');
  });

  it('rejects an invalid email', async () => {
    const result = makeRes();
    await register(makeReq({ name: 'x', email: 'not-an-email', password: 'secret1' }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Please enter a valid email address.');
  });

  it('rejects an already-registered email with 409', async () => {
    mockedUser.findOne.mockResolvedValue(makeUser());
    const result = makeRes();
    await register(makeReq({ name: 'x', email: EMAIL, password: 'secret1' }), result.res);
    expect(result.status).toBe(409);
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('creates the user + default targets and returns a signed token', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    mockedBcrypt.hash.mockResolvedValue('hashed');
    mockedUser.create.mockResolvedValue(makeUser());
    mockedTarget.create.mockResolvedValue({});

    const result = makeRes();
    await register(makeReq({ name: '  Test User  ', email: EMAIL, password: 'secret1' }), result.res);

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('secret1', 12);
    expect(mockedUser.create).toHaveBeenCalledWith(expect.objectContaining({
      email: EMAIL,
      name: 'Test User',
      isGuest: false,
    }));
    expect(mockedTarget.create).toHaveBeenCalledWith(expect.objectContaining({ calories: 2000 }));
    expect(mockedSignToken).toHaveBeenCalledWith(expect.objectContaining({ tokenVersion: 0 }));
    expect(result.status).toBe(201);
    expect(result.body.token).toBe('signed-0');
    expect(result.body.user.email).toBe(EMAIL);
  });
});

describe('login', () => {
  it('rejects missing credentials', async () => {
    const result = makeRes();
    await login(makeReq({ email: EMAIL }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Email and password are required.');
  });

  it('rejects unknown email as invalid credentials', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const result = makeRes();
    await login(makeReq({ email: EMAIL, password: 'whatever' }), result.res);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Invalid email or password.');
  });

  it('rejects guest accounts at login', async () => {
    mockedUser.findOne.mockResolvedValue(makeUser({ isGuest: true }));
    const result = makeRes();
    await login(makeReq({ email: EMAIL, password: 'whatever' }), result.res);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Invalid email or password.');
  });

  it('rejects a wrong password', async () => {
    mockedUser.findOne.mockResolvedValue(makeUser());
    mockedBcrypt.compare.mockResolvedValue(false);
    const result = makeRes();
    await login(makeReq({ email: EMAIL, password: 'wrong' }), result.res);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Invalid email or password.');
  });

  it('signs a fresh token on success (including legacy tokenVersion 0)', async () => {
    mockedUser.findOne.mockResolvedValue(makeUser({ tokenVersion: 0 }));
    mockedBcrypt.compare.mockResolvedValue(true);
    const result = makeRes();
    await login(makeReq({ email: `  ${EMAIL}  `, password: 'secret1' }), result.res);
    expect(mockedUser.findOne).toHaveBeenCalledWith({ email: EMAIL });
    expect(mockedSignToken).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, tokenVersion: 0 }));
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.token).toBe('signed-0');
  });

  it('legacy users without a tokenVersion field still sign with version 0', async () => {
    mockedUser.findOne.mockResolvedValue(makeUser({ tokenVersion: undefined }));
    mockedBcrypt.compare.mockResolvedValue(true);
    const result = makeRes();
    await login(makeReq({ email: EMAIL, password: 'secret1' }), result.res);
    expect(mockedSignToken).toHaveBeenCalledWith(expect.objectContaining({ tokenVersion: 0 }));
    expect(result.body.token).toBe('signed-0');
  });
});

describe('guestLogin', () => {
  it('creates a guest user and returns a signed token', async () => {
    mockedBcrypt.hash.mockResolvedValue('guest-hash');
    mockedUser.create.mockResolvedValue(makeUser({ isGuest: true, email: 'guest_x@guest.foodlens.local', onboardingComplete: true }));
    mockedTarget.create.mockResolvedValue({});
    const result = makeRes();
    await guestLogin(makeReq({}), result.res);
    expect(mockedUser.create).toHaveBeenCalledWith(expect.objectContaining({ isGuest: true }));
    expect(mockedSignToken).toHaveBeenCalledWith(expect.objectContaining({ isGuest: true, tokenVersion: 0 }));
    expect(result.status).toBe(201);
    expect(result.body.user.isGuest).toBe(true);
  });
});

describe('getMe', () => {
  it('returns the user without the password hash', async () => {
    const user = makeUser();
    mockedUser.findById.mockReturnValue({ select: () => user });
    const result = makeRes();
    await getMe(makeReq({}, { userId: USER_ID }), result.res);
    expect(mockedUser.findById).toHaveBeenCalledWith(USER_ID);
    expect(result.body.user).toBe(user);
  });

  it('404s when the user does not exist', async () => {
    mockedUser.findById.mockReturnValue({ select: () => null });
    const result = makeRes();
    await getMe(makeReq({}, { userId: USER_ID }), result.res);
    expect(result.status).toBe(404);
    expect(result.body.error).toBe('User not found.');
  });
});

describe('updateProfile', () => {
  it('404s when the user does not exist', async () => {
    mockedUser.findById.mockResolvedValue(null);
    const result = makeRes();
    await updateProfile(makeReq({ name: 'x' }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(404);
  });

  it('rejects an empty name', async () => {
    mockedUser.findById.mockResolvedValue(makeUser());
    const result = makeRes();
    await updateProfile(makeReq({ name: '   ' }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Name cannot be empty.');
  });

  it('rejects out-of-range profile metrics', async () => {
    mockedUser.findById.mockResolvedValue(makeUser());
    const result = makeRes();
    await updateProfile(makeReq({ profile: { age: 500 } }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('age must be a number between 10 and 120.');
  });

  it('recomputes and persists targets when a metric changes', async () => {
    const user = makeUser();
    mockedUser.findById.mockResolvedValue(user);
    const result = makeRes();
    await updateProfile(makeReq({ profile: { age: 35 } }, { userId: USER_ID }), result.res);

    expect(user.save).toHaveBeenCalled();
    expect(mockedTarget.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [, suggested, opts] = mockedTarget.findOneAndUpdate.mock.calls[0] as [any, any, any];
    expect(opts).toEqual({ upsert: true, new: true });
    expect(suggested.calories).toBeGreaterThan(0);
    expect(result.body.suggestedTargets.calories).toBeGreaterThan(0);
    // Clamped into schema bounds
    expect(result.body.suggestedTargets.calories).toBeLessThanOrEqual(10000);
  });

  it('does NOT touch targets when only the name changes', async () => {
    const user = makeUser();
    mockedUser.findById.mockResolvedValue(user);
    const result = makeRes();
    await updateProfile(makeReq({ name: 'New Name' }, { userId: USER_ID }), result.res);
    expect(user.save).toHaveBeenCalled();
    expect(mockedTarget.findOneAndUpdate).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });
});

describe('convertGuest', () => {
  it('rejects missing fields', async () => {
    const result = makeRes();
    await convertGuest(makeReq({ email: EMAIL, password: 'secret1' }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Name, email, and password are required.');
  });

  it('rejects an email already in use by another account', async () => {
    mockedUser.findOne.mockResolvedValue(makeUser());
    const result = makeRes();
    await convertGuest(makeReq({ name: 'x', email: EMAIL, password: 'secret1' }, { userId: USER_ID }), result.res);
    expect(result.status).toBe(409);
  });

  it('converts the guest, bumps tokenVersion, and issues a new token', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    mockedBcrypt.hash.mockResolvedValue('new-hash');
    mockedUser.findByIdAndUpdate.mockResolvedValue(makeUser({ isGuest: false, tokenVersion: 1 }));

    const result = makeRes();
    await convertGuest(makeReq({ name: 'Real Name', email: EMAIL, password: 'secret1' }, { userId: USER_ID }), result.res);

    expect(mockedUser.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ isGuest: false, $inc: { tokenVersion: 1 } }),
      expect.objectContaining({ new: true })
    );
    expect(mockedSignToken).toHaveBeenCalledWith(expect.objectContaining({ tokenVersion: 1 }));
    expect(result.status).toBe(200);
    expect(result.body.token).toBe('signed-1');
  });
});
