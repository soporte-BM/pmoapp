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

export const updateProject = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        const { project_code, name } = req.body;
        if (!project_code || !name) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const updatedProject = await ProjectRepository.update(id, { project_code, name, status: 'ACTIVE' });
        res.json(updatedProject);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating project', error: error.message || error });
    }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        await ProjectRepository.delete(id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting project', error: error.message || error });
    }
};
