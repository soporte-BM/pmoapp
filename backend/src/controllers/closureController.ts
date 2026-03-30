import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ClosureRepository } from '../repositories/closureRepository';

export const getClosure = async (req: AuthRequest, res: Response) => {
    try {
        const { projectCode, period } = req.query;
        if (!projectCode || !period) {
            const closures = await ClosureRepository.getAllClosures();
            return res.json(closures);
        }
        const closure = await ClosureRepository.getByProjectAndPeriod(projectCode as string, period as string);
        if (!closure) {
            return res.status(404).json({ message: 'Closure not found' });
        }
        res.json(closure);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching closure', error });
    }
};

export const saveClosure = async (req: AuthRequest, res: Response) => {
    try {
        const { projectCode, period, revenue, thirdPartyCosts, resources } = req.body;
        if (!projectCode || !period) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Validations could be stricter here

        const result = await ClosureRepository.saveDraft(
            projectCode,
            period,
            { revenue, thirdPartyCosts, resources },
            req.user?.name || 'Unknown'
        );
        res.json(result);
    } catch (error: any) {
        if (error.message.includes('VALIDATED')) {
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error saving closure', error: error.message });
    }
};

export const validateClosure = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await ClosureRepository.setStatus(Number(id), 'VALIDATED', req.user?.name || 'Unknown');
        res.json({ message: 'Closure validated' });
    } catch (error) {
        res.status(500).json({ message: 'Error validating closure', error });
    }
};

export const unvalidateClosure = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await ClosureRepository.setStatus(Number(id), 'DRAFT', req.user?.name || 'Unknown');
        res.json({ message: 'Closure unvalidated' });
    } catch (error) {
        res.status(500).json({ message: 'Error unvalidating closure', error });
    }
};

export const getClosureKPIs = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        // Re-use logic: fetch by ID (simplification: we can add getById to repo or just query for KPIs)
        // For now, let's assume the frontend uses the main GET /closures endpoint which returns KPIs
        res.status(501).json({ message: 'Use GET /closures?projectCode=...&period=... to get KPIs' });
    } catch (error) {
        res.status(500).json({ message: 'Error', error });
    }
}
