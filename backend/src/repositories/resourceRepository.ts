import sql from 'mssql';
import { getPool } from '../db';

export interface Resource {
    id?: number;
    resource_name: string;
    role: string;
    status: 'ACTIVE' | 'INACTIVE';
}

export const ResourceRepository = {
    getAll: async (): Promise<Resource[]> => {
        const pool = getPool();
        const result = await pool.request().query('SELECT * FROM Resources');
        return result.recordset;
    },

    create: async (resource: Resource): Promise<Resource> => {
        const pool = getPool();
        const result = await pool.request()
            .input('resource_name', sql.VarChar, resource.resource_name)
            .input('role', sql.VarChar, resource.role)
            .query(`
        IF NOT EXISTS (SELECT 1 FROM Resources WHERE resource_name = @resource_name)
        BEGIN
            INSERT INTO Resources (resource_name, role)
            OUTPUT INSERTED.*
            VALUES (@resource_name, @role)
        END
        ELSE
        BEGIN
            SELECT * FROM Resources WHERE resource_name = @resource_name
        END
      `);
        return result.recordset[0];
    },

    update: async (id: number, newName: string): Promise<void> => {
        const pool = getPool();
        // Evitamos inyección cambiando solo si no existe otro con ese nombre o si es el mismo
        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.VarChar, newName)
            .query(`
        IF NOT EXISTS (SELECT 1 FROM Resources WHERE resource_name = @name AND id != @id)
        BEGIN
            UPDATE Resources SET resource_name = @name, updated_at = GETDATE() WHERE id = @id
        END
        ELSE
        BEGIN
            THROW 50000, 'Otro recurso ya tiene el mismo nombre', 1;
        END
      `);
    }
};
