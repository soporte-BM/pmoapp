import { Router } from 'express';
import { getRates, saveRates, getAllRates } from '../controllers/rateController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware as any);

router.get('/all', getAllRates as any);
router.get('/', getRates as any);
router.post('/', requireRole('Admin', 'PMO') as any, saveRates as any);

export default router;
