import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  registerToken,
  getPreferences,
  updatePreferences,
  getLogs,
  sendTestPush,
} from '../controllers/notificationController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Device token registration
router.post('/register-token', registerToken);

// Notification preferences
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// Delivery logs (last 50)
router.get('/logs', getLogs);

// Dev: queue a test push
router.post('/test', sendTestPush);

export default router;
