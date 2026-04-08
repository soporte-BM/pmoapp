import sql from 'mssql';
import { getPool } from '../db';

export interface Project {
    id?: number;
    project_code: string;
    name: string;
    manager?: string;
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
        
        let status = project.status || 'ACTIVE';
        let manager = project.manager || null;

        const result = await pool.request()
            .input('project_code', sql.VarChar, project.project_code)
            .input('name', sql.VarChar, project.name)
            .input('manager', sql.VarChar, manager)
            .input('status', sql.VarChar, status)
            .query(`
        IF NOT EXISTS (SELECT 1 FROM Projects WHERE project_code = @project_code)
        BEGIN
            INSERT INTO Projects (project_code, name, manager, status)
            OUTPUT INSERTED.*
            VALUES (@project_code, @name, @manager, @status)
        END
        ELSE
        BEGIN
            UPDATE Projects 
            SET name = @name, manager = @manager, status = @status
            OUTPUT INSERTED.*
            WHERE project_code = @project_code
        END
      `);
        return result.recordset[0];
    },

    delete: async (id: number): Promise<boolean> => {
        const pool = getPool();
        const transaction = new sql.Transaction(pool);
        
        try {
            await transaction.begin();
            const request = new sql.Request(transaction);
            
            // Delete associated resource hours
            await request.query(`
                DELETE FROM ClosureResourceHours 
                WHERE closure_id IN (SELECT id FROM MonthlyClosures WHERE project_id = ${id})
            `);
            
            // Delete associated closures
            await request.query(`DELETE FROM MonthlyClosures WHERE project_id = ${id}`);
            
            // Delete project
            const result = await request.query(`DELETE FROM Projects WHERE id = ${id}`);
            
            await transaction.commit();
            return result.rowsAffected[0] > 0;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },
};
