import { parsePeriodToMmmYy } from '../utils/format.js';

const STORAGE_KEY = 'pmo_app_data_v1';
const PROJECT_STORAGE_KEY = 'pmo_projects_v1';
const PRO_STORAGE_KEY = 'pmo_professionals_v1';



export const StorageService = {
    getAllEntries: () => {
        const data = sessionStorage.getItem(STORAGE_KEY);
        let entries = [];
        if (data) {
            entries = JSON.parse(data);
        }
        
        let needsSave = false;
        entries = entries.map(e => {
            const parsed = parsePeriodToMmmYy(e.month);
            if (parsed && parsed !== e.month) {
                e.month = parsed;
                needsSave = true;
            }
            return e;
        });
        
        if (needsSave) {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        }
        
        return entries;
    },

    saveEntriesBulk: (entries) => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    },

    getEntriesByProject: (projectName) => {
        const entries = StorageService.getAllEntries();
        return entries.filter(e => e.project === projectName);
    },

    saveEntry: (entry) => {
        const entries = StorageService.getAllEntries();
        const newEntry = { ...entry, id: `e_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` };
        entries.push(newEntry);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        return newEntry;
    },

    updateEntry: (entryId, updatedData) => {
        const entries = StorageService.getAllEntries();
        const index = entries.findIndex(e => e.id === entryId);
        if (index > -1) {
            entries[index] = { ...entries[index], ...updatedData };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } else {
            throw new Error('Registro no encontrado');
        }
    },

    getProjects: () => {
        const data = sessionStorage.getItem(PROJECT_STORAGE_KEY);
        if (!data) {
            return [];
        }
        return JSON.parse(data);
    },

    saveProject: (project) => {
        const projects = StorageService.getProjects();
        if (project.id) {
            const index = projects.findIndex(p => p.id === project.id);
            if (index > -1) {
                projects[index] = project;
            } else {
                projects.push(project);
            }
        } else {
            project.id = `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            projects.push(project);
        }
        sessionStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
        return project;
    },

    saveProjectsBulk: (projectsList) => {
        // As a cache sync, we just replace the whole array exactly mimicking the backend
        sessionStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectsList));
    },

    getProfessionals: () => {
        const data = sessionStorage.getItem(PRO_STORAGE_KEY);
        if (!data) return [];
        
        let pros = JSON.parse(data);
        let needsSave = false;
        pros = pros.map(p => {
            const parsed = parsePeriodToMmmYy(p.period);
            if (parsed && parsed !== p.period) {
                p.period = parsed;
                needsSave = true;
            }
            return p;
        });
        
        if (needsSave) {
            sessionStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(pros));
        }
        
        return pros;
    },

    saveProfessional: (pro) => {
        const pros = StorageService.getProfessionals();
        if (pro.id) {
            const index = pros.findIndex(p => p.id === pro.id);
            if (index > -1) {
                pros[index] = pro;
            } else {
                pros.push(pro);
            }
        } else {
            pros.push({ ...pro, id: `pro_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` });
        }
        sessionStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(pros));
    },

    saveProfessionalsBulk: (prosList) => {
        // Como sincronización estricta con Azure, reemplazamos todo el caché con lo recibido por la API
        sessionStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(prosList));
    },

    deleteProfessional: (proId) => {
        const pros = StorageService.getProfessionals();
        const proToDelete = pros.find(p => p.id === proId);
        if(!proToDelete) throw new Error("Profesional no encontrado");
        
        // Validation: Check if the professional has associated data in Cierre de Mes / Historical
        const entries = StorageService.getAllEntries();
        const isUsed = entries.some(entry => 
             entry.month === proToDelete.period && 
             entry.professionals && 
             entry.professionals.some(p => p.name === proToDelete.name)
        );

        if(isUsed) {
            throw new Error("No se puede eliminar: El profesional tiene registros asociados en Cierre de Mes o datos históricos en este periodo.");
        }

        const updatedPros = pros.filter(p => p.id !== proId);
        sessionStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(updatedPros));
    },

    clearData: () => {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(PROJECT_STORAGE_KEY);
        sessionStorage.removeItem(PRO_STORAGE_KEY);
    }
};
