import { Router } from 'express';
import { getProjects, createProject } from '../controllers/projectController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware as any);

router.get('/', getProjects as any);
router.post('/', requireRole('Admin') as any, createProject as any);

export default router;
