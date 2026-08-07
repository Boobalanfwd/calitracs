import { Router } from 'express';
import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { captureError, getErrorCount, getRecentErrors } from '../utils/logger';
import { getMetrics } from '../middlewares/requestMetrics';
import { getDBStatus } from '../config/db';
import { getWorkerStats } from '../services/notificationWorker';

const router = Router();

// ── GET /health ──────────────────────────────────────────────────────────────
export const healthHandler = (_req: Request, res: Response): void => {
  const db = getDBStatus();
  const metrics = getMetrics();
  res.json({
    status: db.connected ? 'ok' : 'degraded',
    service: 'Calitracs Backend',
    timestamp: new Date().toISOString(),
    uptimeSec: metrics.uptimeSec,
    db,
    worker: getWorkerStats(),
    metrics: {
      totalRequests: metrics.requests.total,
      error5xx: metrics.requests.error5xx,
      recentErrors: getErrorCount(),
      heapUsedBytes: metrics.memory.heapUsedBytes,
    },
  });
};

// ── GET /metrics ─────────────────────────────────────────────────────────────
export const metricsHandler = (_req: Request, res: Response): void => {
  res.json({ success: true, ...getMetrics(), errors: { count: getErrorCount() } });
};

// ── GET /health/errors (guarded) ─────────────────────────────────────────────
// Error messages can leak internals, so they're only served when an
// OBSERVABILITY_KEY is configured AND the caller supplies it as `?key=`.
// Returns 404 (not 403) when unconfigured/wrong so the endpoint stays hidden.
export const errorsHandler = (req: Request, res: Response): void => {
  const key = process.env.OBSERVABILITY_KEY;
  if (!key || req.query.key !== key) {
    res.status(404).json({ success: false, error: 'Route not found' });
    return;
  }
  res.json({ success: true, count: getErrorCount(), errors: getRecentErrors() });
};

// ── POST /api/log/client-error ───────────────────────────────────────────────
// Fire-and-forget ingestion for mobile crash/render errors. No auth (the device
// may not have a session during a crash); throttled per-IP.
const clientErrorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many error reports. Please try again later.' },
});

export const clientErrorHandler = (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawMessage = typeof body.message === 'string' ? body.message : '';
  const message = rawMessage.trim().slice(0, 500) || 'Unknown client error';
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 60) : 'mobile';
  const stack = typeof body.stack === 'string' && body.stack.trim() ? body.stack.trim().slice(0, 2000) : undefined;

  const err = new Error(message);
  if (stack) err.stack = stack;

  captureError(err, source, {
    client: true,
    screen: typeof body.screen === 'string' ? body.screen.slice(0, 80) : undefined,
    platform: typeof body.platform === 'string' ? body.platform.slice(0, 20) : undefined,
    dev: typeof body.dev === 'boolean' ? body.dev : undefined,
  });

  res.json({ success: true });
};

router.get('/health', healthHandler);
router.get('/metrics', metricsHandler);
router.get('/health/errors', errorsHandler);
router.post('/api/log/client-error', clientErrorLimiter, clientErrorHandler);

export default router;
