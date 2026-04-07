"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.createProject = exports.getProjects = void 0;
const projectRepository_1 = require("../repositories/projectRepository");
const getProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projects = yield projectRepository_1.ProjectRepository.getAll();
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error });
    }
});
exports.getProjects = getProjects;
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { project_code, name, manager, status } = req.body;
        if (!project_code || !name) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        let normalizedStatus = (status && status.toUpperCase() === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE';
        const newProject = yield projectRepository_1.ProjectRepository.create({
            project_code,
            name,
            manager,
            status: normalizedStatus
        });
        res.status(201).json(newProject);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating project', error: error.message });
    }
});
exports.createProject = createProject;
const deleteProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'Invalid project ID' });
        }
        const success = yield projectRepository_1.ProjectRepository.delete(id);
        if (success) {
            res.json({ message: 'Project deleted successfully' });
        }
        else {
            res.status(404).json({ message: 'Project not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting project', error: error.message });
    }
});
exports.deleteProject = deleteProject;
