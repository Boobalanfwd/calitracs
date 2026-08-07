import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthPayload, JWT_SECRET, signToken, authMiddleware, clearTokenVersionCache, invalidateTokenVersionCache } from './auth';

vi.mock('../models/User', () => {
  const findById = vi.fn();
  return { User: { findById } };
});

import { User } from '../models/User';

const mockedFindById = vi.mocked(User.findById);

function makeReq(token?: string) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} } as any;
}

function makeRes() {
  let statusCode: number | null = null;
  let body: any = null;
  const res: any = {
    status(c: number) {
      statusCode = c;
      return { json: (b: any) => { body = b; } };
    },
  };
  return {
    res,
    get status() { return statusCode; },
    get body() { return body; },
  };
}

function legacyChain(user: any) {
  return () => ({ select: () => ({ lean: () => user }) });
}

const VALID_USER_ID = '507f1f77bcf86cd799439011';
const validPayload: AuthPayload = { userId: VALID_USER_ID, email: 'a@b.c', isGuest: false, tokenVersion: 0 };

describe('signToken', () => {
  it('signs an HS256 token that verifies back with the same secret', () => {
    const token = signToken(validPayload);
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    expect(decoded).toMatchObject(validPayload);
  });

  it('signs with the exported secret', () => {
    const token = signToken(validPayload);
    expect(jwt.decode(token)).toMatchObject({ tokenVersion: 0 });
  });
});

describe('authMiddleware', () => {
  beforeEach(() => {
    mockedFindById.mockReset();
    // The tokenVersion cache is module-level — reset it so each test hits the
    // (mocked) DB exactly as expected.
    clearTokenVersionCache();
  });

  it('rejects requests without a bearer token', async () => {
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(makeReq(), result.res, next);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Authentication required. Please log in.');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects garbage tokens', async () => {
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(makeReq('not-a-jwt'), result.res, next);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Invalid token. Please log in again.');
  });

  it('rejects expired tokens with the expiry message', async () => {
    const expired = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '-10s', algorithm: 'HS256' });
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(makeReq(expired), result.res, next);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Session expired. Please log in again.');
  });

  it('rejects revoked sessions on a tokenVersion bump', async () => {
    mockedFindById.mockImplementation(legacyChain({ tokenVersion: 1, isGuest: false }));
    const token = signToken({ ...validPayload, tokenVersion: 0 });
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(makeReq(token), result.res, next);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Session is no longer valid. Please log in again.');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects unknown users', async () => {
    mockedFindById.mockImplementation(legacyChain(null));
    const token = signToken(validPayload);
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(makeReq(token), result.res, next);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Session is no longer valid. Please log in again.');
  });

  it('accepts a valid token and populates req.user', async () => {
    mockedFindById.mockImplementation(legacyChain({ tokenVersion: 0, isGuest: false }));
    const token = signToken(validPayload);
    const req = makeReq(token);
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(req, result.res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ userId: VALID_USER_ID });
  });

  // Regression: accounts created before Phase 4 have NO tokenVersion field.
  it('allows legacy users (no tokenVersion field) with a fresh token', async () => {
    mockedFindById.mockImplementation(legacyChain({ tokenVersion: undefined, isGuest: false }));
    const token = signToken(validPayload); // login signs tokenVersion: user.tokenVersion || 0 => 0
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(makeReq(token), result.res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('still revokes a legacy account when the token version was bumped', async () => {
    mockedFindById.mockImplementation(legacyChain({ tokenVersion: undefined, isGuest: false }));
    const token = signToken({ ...validPayload, tokenVersion: 1 });
    const result = makeRes();
    const next = vi.fn();
    await authMiddleware(makeReq(token), result.res, next);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('Session is no longer valid. Please log in again.');
  });

  it('serves repeat requests for the same user from the cache (no second DB hit)', async () => {
    mockedFindById.mockImplementation(legacyChain({ tokenVersion: 0, isGuest: false }));
    const token = signToken(validPayload);

    const first = makeRes();
    const firstNext = vi.fn();
    await authMiddleware(makeReq(token), first.res, firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(mockedFindById).toHaveBeenCalledTimes(1);

    const second = makeRes();
    const secondNext = vi.fn();
    await authMiddleware(makeReq(token), second.res, secondNext);
    expect(secondNext).toHaveBeenCalledTimes(1);
    expect(mockedFindById).toHaveBeenCalledTimes(1); // still 1 — cached
  });

  it('invalidating the cache re-reads the DB on the next request', async () => {
    mockedFindById.mockImplementation(legacyChain({ tokenVersion: 0, isGuest: false }));
    const token = signToken(validPayload);

    const first = makeRes();
    const firstNext = vi.fn();
    await authMiddleware(makeReq(token), first.res, firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    // Bump happens server-side (guest conversion / password change)...
    invalidateTokenVersionCache(VALID_USER_ID);
    mockedFindById.mockImplementation(legacyChain({ tokenVersion: 1, isGuest: false }));

    // ...so the OLD token must be rejected immediately, not after the TTL.
    const second = makeRes();
    const secondNext = vi.fn();
    await authMiddleware(makeReq(token), second.res, secondNext);
    expect(secondNext).not.toHaveBeenCalled();
    expect(second.status).toBe(401);
    expect(mockedFindById).toHaveBeenCalledTimes(2);
  });

  it('does not cache a missing user (re-reads DB every time)', async () => {
    mockedFindById.mockImplementation(legacyChain(null));
    const token = signToken(validPayload);
    for (let i = 0; i < 2; i++) {
      const result = makeRes();
      const next = vi.fn();
      await authMiddleware(makeReq(token), result.res, next);
      expect(result.status).toBe(401);
    }
    expect(mockedFindById).toHaveBeenCalledTimes(2);
  });
});
