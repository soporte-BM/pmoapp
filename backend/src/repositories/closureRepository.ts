import sql from 'mssql';
import { getPool } from '../db';

export interface ClosureEntry {
    resourceName: string;
    hours: number;
}

export interface Closure {
    id?: number;
    project_id: number;
    period: string;
    status: 'DRAFT' | 'VALIDATED';
    revenue: number;
    third_party_costs: number;
    resources?: any[];
    kpis?: any;
}

export const ClosureRepository = {
    getByProjectAndPeriod: async (projectCode: string, period: string) => {
        const pool = getPool();
        // Get Closure Header
        const closureResult = await pool.request()
            .input('project_code', sql.VarChar, projectCode)
            .input('period', sql.Date, period)
            .query(`
        SELECT c.*, p.name as project_name 
        FROM MonthlyClosures c
        JOIN Projects p ON c.project_id = p.id
        WHERE p.project_code = @project_code AND c.period = @period
      `);

        if (closureResult.recordset.length === 0) return null;

        const closure = closureResult.recordset[0];

        // Get Resources
        const resourcesResult = await pool.request()
            .input('closure_id', sql.Int, closure.id)
            .query(`
        SELECT crh.*, r.resource_name, r.role
        FROM ClosureResourceHours crh
        JOIN Resources r ON crh.resource_id = r.id
        WHERE crh.closure_id = @closure_id
      `);

        closure.resources = resourcesResult.recordset;

        // Calculate KPIs
        let laborDirect = 0;
        let laborIndirect = 0;

        closure.resources.forEach((r: any) => {
            laborDirect += r.hours * r.rate_snapshot_direct;
            laborIndirect += r.hours * r.rate_snapshot_indirect;
        });

        const totalCost = laborDirect + laborIndirect + closure.third_party_costs;
        const margin = closure.revenue - totalCost;
        const profitability = closure.revenue > 0 ? (margin / closure.revenue) * 100 : 0;

        closure.kpis = {
            laborDirectCost: laborDirect,
            laborIndirectCost: laborIndirect,
            totalCost,
            margin,
            profitabilityPct: parseFloat(profitability.toFixed(2))
        };

        return closure;
    },

    getAllClosures: async () => {
        const pool = getPool();
        // Get all closures with project names
        const closureResult = await pool.request()
            .query(`
        SELECT c.*, p.name as project_name 
        FROM MonthlyClosures c
        JOIN Projects p ON c.project_id = p.id
      `);

        if (closureResult.recordset.length === 0) return [];

        const closures = closureResult.recordset;

        // Get all resources for all closures
        const resourcesResult = await pool.request()
            .query(`
        SELECT crh.*, r.resource_name, r.role
        FROM ClosureResourceHours crh
        JOIN Resources r ON crh.resource_id = r.id
      `);

        const resourcesByClosure = new Map();
        resourcesResult.recordset.forEach(r => {
            if (!resourcesByClosure.has(r.closure_id)) {
                resourcesByClosure.set(r.closure_id, []);
            }
            resourcesByClosure.get(r.closure_id).push(r);
        });

        // Map resources to closures
        const mappedClosures = closures.map((closure: any) => {
            closure.resources = resourcesByClosure.get(closure.id) || [];
            
            // Calculate KPIs
            let laborDirect = 0;
            let laborIndirect = 0;

            closure.resources.forEach((r: any) => {
                laborDirect += r.hours * r.rate_snapshot_direct;
                laborIndirect += r.hours * r.rate_snapshot_indirect;
            });

            const totalCost = laborDirect + laborIndirect + closure.third_party_costs;
            const margin = closure.revenue - totalCost;
            const profitability = closure.revenue > 0 ? (margin / closure.revenue) * 100 : 0;

            closure.kpis = {
                laborDirectCost: laborDirect,
                laborIndirectCost: laborIndirect,
                totalCost,
                margin,
                profitabilityPct: parseFloat(profitability.toFixed(2))
            };

            return closure;
        });

        return mappedClosures;
    },

    saveDraft: async (projectCode: string, period: string, data: any, user: string) => {
        const pool = getPool();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            // 1. Get Project ID
            const projRes = await transaction.request()
                .input('code', sql.VarChar, projectCode)
                .query('SELECT id FROM Projects WHERE project_code = @code');

            if (projRes.recordset.length === 0) throw new Error('Project not found');
            const projectId = projRes.recordset[0].id;

            // 2. Upsert Closure Header
            // Check existence
            const checkRes = await transaction.request()
                .input('project_id', sql.Int, projectId)
                .input('period', sql.Date, period)
                .query('SELECT id, status FROM MonthlyClosures WHERE project_id = @project_id AND period = @period');

            let closureId;

            if (checkRes.recordset.length > 0) {
                const existing = checkRes.recordset[0];
                if (existing.status === 'VALIDATED') {
                    throw new Error('Cannot modify a VALIDATED closure. Unvalidate first.');
                }
                closureId = existing.id;

                await transaction.request()
                    .input('id', sql.Int, closureId)
                    .input('revenue', sql.Decimal(15, 2), data.revenue)
                    .input('tpc', sql.Decimal(15, 2), data.thirdPartyCosts)
                    .input('user', sql.VarChar, user)
                    .query(`
                    UPDATE MonthlyClosures 
                    SET revenue = @revenue, third_party_costs = @tpc, updated_at = GETDATE() -- created_by ignored on update usually
                    WHERE id = @id
                `);
            } else {
                const insertRes = await transaction.request()
                    .input('project_id', sql.Int, projectId)
                    .input('period', sql.Date, period)
                    .input('revenue', sql.Decimal(15, 2), data.revenue)
                    .input('tpc', sql.Decimal(15, 2), data.thirdPartyCosts)
                    .input('user', sql.VarChar, user)
                    .query(`
                    INSERT INTO MonthlyClosures (project_id, period, status, revenue, third_party_costs, created_by)
                    OUTPUT INSERTED.id
                    VALUES (@project_id, @period, 'DRAFT', @revenue, @tpc, @user)
                `);
                closureId = insertRes.recordset[0].id;
            }

            // 3. Update Resources (Delete all and Re-insert logic is simplest for full save)
            await transaction.request()
                .input('closure_id', sql.Int, closureId)
                .query('DELETE FROM ClosureResourceHours WHERE closure_id = @closure_id');

            for (const line of data.resources) {
                // Find resource and Get Rate for Period
                const rateRes = await transaction.request()
                    .input('name', sql.VarChar, line.resourceName)
                    .input('period', sql.Date, period)
                    .query(`
                    SELECT r.id, COALESCE(rr.direct_rate, 0) as direct_rate, COALESCE(rr.indirect_rate, 0) as indirect_rate
                    FROM Resources r
                    LEFT JOIN ResourceMonthlyRates rr ON r.id = rr.resource_id AND rr.period = @period
                    WHERE r.resource_name = @name
                `);

                if (rateRes.recordset.length === 0) throw new Error(`Resource ${line.resourceName} not found`);

                const rData = rateRes.recordset[0];
                // Optional: Block if rate is 0? For now allow, but maybe warn. DRAFT allows it.

                await transaction.request()
                    .input('closure_id', sql.Int, closureId)
                    .input('resource_id', sql.Int, rData.id)
                    .input('hours', sql.Decimal(10, 2), line.hours)
                    .input('direct', sql.Decimal(10, 2), rData.direct_rate)
                    .input('indirect', sql.Decimal(10, 2), rData.indirect_rate)
                    .query(`
                    INSERT INTO ClosureResourceHours (closure_id, resource_id, hours, rate_snapshot_direct, rate_snapshot_indirect)
                    VALUES (@closure_id, @resource_id, @hours, @direct, @indirect)
                `);
            }

            await transaction.commit();
            return { id: closureId, status: 'DRAFT' };

        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    },

    setStatus: async (id: number, status: 'DRAFT' | 'VALIDATED', user: string) => {
        const pool = getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.VarChar, status)
            .input('user', sql.VarChar, user)
            .query(`
            UPDATE MonthlyClosures 
            SET status = @status, 
                validated_by = CASE WHEN @status = 'VALIDATED' THEN @user ELSE validated_by END,
                validated_at = CASE WHEN @status = 'VALIDATED' THEN GETDATE() ELSE validated_at END
            WHERE id = @id
        `);
        return { id, status };
    }
};
