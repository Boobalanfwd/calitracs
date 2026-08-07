import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB, disconnectDB, isDBConnected } from './config/db';
import foodRoutes from './routes/food';
import authRoutes from './routes/auth';
import logsRoutes from './routes/logs';
import targetsRoutes from './routes/targets';
import notificationsRoutes from './routes/notifications';
import { startNotificationWorker, stopNotificationWorker } from './services/notificationWorker';
import { startNotificationOrchestrator } from './services/notificationOrchestrator';
import observabilityRouter from './routes/observability';
import { requestMetrics } from './middlewares/requestMetrics';
import { info, warn, captureError } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Behind a reverse proxy (Render/nginx) so rate limiting sees the real client IP.
app.set('trust proxy', 1);

// Middleware
app.use(compression());
app.use(helmet());
app.use(
  cors({
    origin: [
      'https://calitracs-backend.onrender.com',
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      /^https:\/\/[a-z0-9-]+\.calitracs\.(app|dev|com)$/i,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);
app.options('*', cors());

// Images arrive as base64 JSON after being downscaled to 1280px/0.7 JPEG on
// device (~2MB base64 worst case) — 10mb keeps headroom without a 15mb abuse surface.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate limiting ────────────────────────────────────────────────────────────
// Per-IP limits protect the auth endpoints from brute force / account-creation
// floods and the food endpoints (paid Gemini + Cloudinary) from cost abuse.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many signup attempts. Please try again in an hour.' },
});
const guestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many guest sessions from this device. Please try again later.' },
});
const authApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
const foodLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/guest', guestLimiter);
app.use('/api/auth', authApiLimiter);
app.use('/api/food', foodLimiter);
app.use('/api', apiLimiter);

// Request metrics — counters + latency for /metrics (before routing).
app.use(requestMetrics);

// Request logging — JSON line per request (method, path, status, duration,
// user id) so production issues can be correlated. Slow requests are flagged.
const SLOW_REQUEST_MS = 1500;
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const [s, ns] = process.hrtime(start);
    const durationMs = Math.round(s * 1000 + ns / 1e6);
    const fields: Record<string, unknown> = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      user: (req.user?.userId || '-').toString(),
      ip: req.ip,
    };
    const bytes = res.get('Content-Length');
    if (bytes) fields.bytes = parseInt(bytes, 10);
    if (durationMs >= SLOW_REQUEST_MS) {
      warn('Slow request', fields);
    } else {
      info('Request', fields);
    }
  });
  next();
});

// Cache-Control for read-heavy endpoints so repeat tab focuses hit the client cache.
app.use((req, res, next) => {
  if (req.method === 'GET') {
    if (req.path.startsWith('/api/logs/calendar') || req.path.startsWith('/api/logs/water/weekly')) {
      res.set('Cache-Control', 'private, max-age=300');
    } else if (req.path.startsWith('/api/targets')) {
      res.set('Cache-Control', 'private, max-age=60');
    } else if (req.path.startsWith('/api/logs')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
  next();
});

// Routes
app.use('/api/food', foodRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/targets', targetsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Observability: GET /health, GET /metrics, GET /health/errors, POST /api/log/client-error
app.use(observabilityRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Malformed JSON body → body-parser SyntaxError (status 400). Respect the
  // status on the error so 4xx client mistakes aren't reported as 5xx server
  // failures.
  const status = err.status || err.statusCode || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  if (safeStatus >= 500) {
    captureError(err, 'http', { method: req.method, path: req.originalUrl });
  } else {
    warn('Request error', {
      method: req.method,
      path: req.originalUrl,
      status: safeStatus,
      message: err.message,
    });
  }

  const message =
    err.type === 'entity.parse.failed'
      ? 'Invalid JSON in request body.'
      : safeStatus >= 500
      ? 'Internal server error'
      : err.expose
      ? err.message
      : 'Bad request';

  res.status(safeStatus).json({ success: false, error: message });
});

// Start server
const startServer = async () => {
  // Kick off the DB connection in the background — don't block boot on Mongo.
  // connectDB() retries with backoff internally, so a slow cold start doesn't
  // delay the HTTP listener.
  connectDB();

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n🚀 Calitracs v2.0 backend running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth: /api/auth/register | /api/auth/login | /api/auth/guest`);
    console.log(`📊 Logs: /api/logs/:date | /api/logs/entry`);
    console.log(`🎯 Targets: /api/targets`);
    console.log(`🔔 Notifications: /api/notifications`);
    if (!isDBConnected()) {
      console.log(`🟡 MongoDB offline — auth and logs require DB. Fix Atlas credentials.`);
    }
    // Start notification worker and orchestrator after DB connects
    startNotificationWorker();
    startNotificationOrchestrator();
  });

  // Graceful shutdown — stop accepting requests, stop the worker, close the DB.
  const shutdown = (signal: string) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
    stopNotificationWorker();
    server.close(async () => {
      await disconnectDB();
      console.log('[Server] Bye.');
      process.exit(0);
    });
    // Hard stop if something hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
