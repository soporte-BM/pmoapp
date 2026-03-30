import { Router } from 'express';
import { getResources, createResource } from '../controllers/resourceController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware as any);

router.get('/', getResources as any);
router.post('/', requireRole('Admin', 'PMO') as any, createResource as any);

export default router;
