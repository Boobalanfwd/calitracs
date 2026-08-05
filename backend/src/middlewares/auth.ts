import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  email: string;
  isGuest: boolean;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const JWT_SECRET = process.env.JWT_SECRET || 'foodlens_ai_dev_secret_change_in_production';
export const JWT_EXPIRES_IN = '90d'; // 90 days — stay logged in

export const signToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
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
