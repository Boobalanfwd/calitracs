import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, isDBConnected } from './config/db';
import foodRoutes from './routes/food';
import authRoutes from './routes/auth';
import logsRoutes from './routes/logs';
import targetsRoutes from './routes/targets';
import notificationsRoutes from './routes/notifications';
import { startNotificationWorker } from './services/notificationWorker';
import { startNotificationOrchestrator } from './services/notificationOrchestrator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/food', foodRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/targets', targetsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Calitracs Backend v2.0',
    db: isDBConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    routes: ['/api/auth', '/api/food', '/api/logs', '/api/targets'],
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(Number(PORT), '0.0.0.0', () => {
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
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
