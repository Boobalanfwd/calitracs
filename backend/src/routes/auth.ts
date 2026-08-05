import { Router } from 'express';
import { register, login, guestLogin, getMe, updateProfile, convertGuest, uploadAvatar } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/guest', guestLogin);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);
router.post('/convert-guest', authMiddleware, convertGuest);
router.post('/avatar', authMiddleware, uploadAvatar);

export default router;
