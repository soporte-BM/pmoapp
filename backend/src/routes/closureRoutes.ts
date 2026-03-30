import { Router } from 'express';
import { getClosure, saveClosure, validateClosure, unvalidateClosure, getClosureKPIs } from '../controllers/closureController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware as any);

router.get('/', getClosure as any);
router.get('/:id/kpis', getClosureKPIs as any);
router.post('/', requireRole('Admin', 'PMO') as any, saveClosure as any);
router.post('/:id/validate', requireRole('Admin', 'PMO') as any, validateClosure as any);
router.post('/:id/unvalidate', requireRole('Admin') as any, unvalidateClosure as any);

export default router;
