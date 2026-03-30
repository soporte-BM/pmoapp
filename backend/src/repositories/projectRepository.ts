import sql from 'mssql';
import { getPool } from '../db';

export interface Project {
    id?: number;
    project_code: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
}

export const ProjectRepository = {
    getAll: async (): Promise<Project[]> => {
        const pool = getPool();
        const result = await pool.request().query('SELECT * FROM Projects');
        return result.recordset;
    },

    create: async (project: Project): Promise<Project> => {
        const pool = getPool();
        const result = await pool.request()
            .input('project_code', sql.VarChar, project.project_code)
            .input('name', sql.VarChar, project.name)
            .query(`
        INSERT INTO Projects (project_code, name)
        OUTPUT INSERTED.*
        VALUES (@project_code, @name)
      `);
        return result.recordset[0];
    },
};
