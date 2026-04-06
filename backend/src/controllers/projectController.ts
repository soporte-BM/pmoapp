import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProjectRepository } from '../repositories/projectRepository';

export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const projects = await ProjectRepository.getAll();
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error });
    }
};

export const createProject = async (req: AuthRequest, res: Response) => {
    try {
        const { project_code, name, manager, status } = req.body;
        if (!project_code || !name) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        let normalizedStatus = (status && status.toUpperCase() === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE';
        
        const newProject = await ProjectRepository.create({ 
            project_code, 
            name, 
            manager,
            status: normalizedStatus as 'ACTIVE' | 'INACTIVE'
        });
        res.status(201).json(newProject);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating project', error: error.message });
    }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'Invalid project ID' });
        }
        
        const success = await ProjectRepository.delete(id);
        if (success) {
            res.json({ message: 'Project deleted successfully' });
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting project', error: error.message });
    }
};
