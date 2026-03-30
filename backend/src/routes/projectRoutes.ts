import { Router } from 'express';
import { getProjects, createProject, updateProject, deleteProject } from '../controllers/projectController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware as any);

router.get('/', getProjects as any);
router.post('/', requireRole('Admin') as any, createProject as any);
router.put('/:id', requireRole('Admin') as any, updateProject as any);
router.delete('/:id', requireRole('Admin') as any, deleteProject as any);

export default router;
