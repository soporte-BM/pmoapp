import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProjectRepository } from '../repositories/projectRepository';

export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const projects = await ProjectRepository.getAll();
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching projects', error: error.message || error });
    }
};

export const createProject = async (req: AuthRequest, res: Response) => {
    try {
        const { project_code, name } = req.body;
        if (!project_code || !name) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const newProject = await ProjectRepository.create({ project_code, name, status: 'ACTIVE' });
        res.status(201).json(newProject);
    } catch (error) {
        res.status(500).json({ message: 'Error creating project', error });
    }
};
