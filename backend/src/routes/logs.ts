import { Router } from 'express';
import { getLog, addEntry, deleteEntry, getCalendarMonth, updateWaterIntake, deleteWaterEntry } from '../controllers/logsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware); // All log routes require auth

router.get('/calendar/:year/:month', getCalendarMonth);
router.post('/water', updateWaterIntake);
router.delete('/water/:waterId', deleteWaterEntry);
router.get('/:date', getLog); // date = 'today' or YYYY-MM-DD
router.post('/entry', addEntry);
router.delete('/entry/:entryId', deleteEntry);

export default router;
