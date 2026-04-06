import { Router } from 'express';
import { getResources, createResource, updateResource, deleteResource } from '../controllers/resourceController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware as any);

router.get('/', getResources as any);
router.post('/', requireRole('Admin', 'PMO') as any, createResource as any);
router.put('/:id', requireRole('Admin', 'PMO') as any, updateResource as any);
router.delete('/:id', requireRole('Admin', 'PMO') as any, deleteResource as any);

export default router;
