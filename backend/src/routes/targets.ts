import { Router } from 'express';
import { getTargets, updateTargets, getSuggestedTargets } from '../controllers/targetsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getTargets);
router.put('/', updateTargets);
router.get('/suggested', getSuggestedTargets);

export default router;
