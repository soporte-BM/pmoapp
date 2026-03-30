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

    update: async (id: number, project: Project): Promise<Project> => {
        const pool = getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('project_code', sql.VarChar, project.project_code)
            .input('name', sql.VarChar, project.name)
            .query(`
                UPDATE Projects
                SET project_code = @project_code, name = @name
                OUTPUT INSERTED.*
                WHERE id = @id
            `);
        if (!result.recordset || result.recordset.length === 0) throw new Error('Project not found');
        return result.recordset[0];
    },

    delete: async (id: number): Promise<void> => {
        const pool = getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const request = new sql.Request(transaction);
            request.input('id', sql.Int, id);

            // Delete associated closures (ClosureResourceHours deletes via ON DELETE CASCADE)
            await request.query('DELETE FROM MonthlyClosures WHERE project_id = @id');
            await request.query('DELETE FROM Projects WHERE id = @id');
            
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },
};
