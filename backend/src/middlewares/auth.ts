import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export interface AuthPayload {
  userId: string;
  email: string;
  isGuest: boolean;
  tokenVersion: number;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// JWT_SECRET must come from the environment in production — a module-level throw
// fails fast at boot so the server can never sign tokens with a known secret.
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in the production environment.');
  }
  return 'calitracs_local_dev_only_insecure_secret';
};

export const JWT_SECRET = getJwtSecret();
export const JWT_EXPIRES_IN = '90d'; // 90 days — stay logged in

export const signToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
};

// ── Token-version cache ──────────────────────────────────────────────────────
// Rejecting revoked sessions used to cost one indexed `users` read per request.
// Cache the normalized tokenVersion per user with a short TTL so the common
// (unrevoked) path is DB-free. `tokenVersion` only changes on guest conversion /
// password change, which invalidates the cache entry in the same process.
interface TokenVersionEntry {
  version: number;
  fetchedAt: number;
}

const TOKEN_VERSION_CACHE_TTL_MS = 60_000;
const tokenVersionCache = new Map<string, TokenVersionEntry>();

export function clearTokenVersionCache(): void {
  tokenVersionCache.clear();
}

export function invalidateTokenVersionCache(userId: string): void {
  tokenVersionCache.delete(userId);
}

/**
 * Return the user's current normalized tokenVersion (undefined → 0), or `null`
 * when the user does not exist. Reads the DB on a cache miss and refills the cache.
 */
async function getStoredTokenVersion(userId: string): Promise<number | null> {
  const cached = tokenVersionCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < TOKEN_VERSION_CACHE_TTL_MS) {
    return cached.version;
  }
  const user = await User.findById(userId).select('tokenVersion').lean();
  if (!user) return null;
  const version = user.tokenVersion || 0;
  tokenVersionCache.set(userId, { version, fetchedAt: Date.now() });
  return version;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AuthPayload;

    // Reject revoked sessions: a tokenVersion bump (guest conversion, password
    // change) invalidates every previously issued token for this user.
    // Normalize with `|| 0`: accounts created before tokenVersion existed have
    // no such field (undefined), which would otherwise permanently lock them out
    // (undefined !== 0 even with a freshly-issued token).
    const storedVersion = await getStoredTokenVersion(decoded.userId);
    if (storedVersion === null || storedVersion !== (decoded.tokenVersion || 0)) {
      res.status(401).json({ success: false, error: 'Session is no longer valid. Please log in again.' });
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    const jwtErr = err as Error;
    if (jwtErr.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid token. Please log in again.' });
    }
  }
};
