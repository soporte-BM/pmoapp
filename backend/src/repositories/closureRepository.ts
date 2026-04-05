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

const parsePeriodToSqlDate = (periodStr: string): string => {
    if (!periodStr) return periodStr;
    const s = periodStr.trim().toLowerCase();
    const match = s.match(/^([a-z]{3})[-\s/]+(\d{2,4})$/);
    if (match) {
        let year = parseInt(match[2]);
        if (year < 100) year += 2000;
        const monthIndexes: { [key: string]: string } = { 'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12', 'jan': '01', 'apr': '04', 'aug': '08', 'dec': '12' };
        const m = monthIndexes[match[1]];
        if (m) return `${year}-${m}-01`;
    }
    return periodStr;
};

export const ClosureRepository = {
    getAll: async () => {
        const pool = getPool();
        // Get all closure headers
        const closuresResult = await pool.request()
            .query(`
        SELECT c.*, p.name as project_name, p.project_code 
        FROM MonthlyClosures c
        JOIN Projects p ON c.project_id = p.id
      `);

        if (closuresResult.recordset.length === 0) return [];

        const closures = closuresResult.recordset;

        // Get all closure hours
        const resourcesResult = await pool.request()
            .query(`
        SELECT crh.*, r.resource_name, r.role
        FROM ClosureResourceHours crh
        JOIN Resources r ON crh.resource_id = r.id
      `);

        const allHours = resourcesResult.recordset;

        closures.forEach(closure => {
            const closureHours = allHours.filter(h => h.closure_id === closure.id);
            closure.resources = closureHours;

            let laborDirect = 0;
            let laborIndirect = 0;

            closureHours.forEach((r: any) => {
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
        });

        return closures;
    },

    getByProjectAndPeriod: async (projectCode: string, period: string) => {
        const pool = getPool();
        // Get Closure Header
        const closureResult = await pool.request()
            .input('project_code', sql.VarChar, projectCode)
            .input('period', sql.Date, parsePeriodToSqlDate(period))
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
                .input('period', sql.Date, parsePeriodToSqlDate(period))
                .query('SELECT id, status FROM MonthlyClosures WHERE project_id = @project_id AND period = @period');

            let closureId;

            if (checkRes.recordset.length > 0) {
                const existing = checkRes.recordset[0];
                closureId = existing.id;
                const finalStatus = data.status || 'DRAFT';

                await transaction.request()
                    .input('id', sql.Int, closureId)
                    .input('revenue', sql.Decimal(15, 2), data.revenue)
                    .input('tpc', sql.Decimal(15, 2), data.thirdPartyCosts)
                    .input('user', sql.VarChar, user)
                    .input('status', sql.VarChar, finalStatus)
                    .query(`
                    UPDATE MonthlyClosures 
                    SET revenue = @revenue, third_party_costs = @tpc, status = @status, updated_at = GETDATE() -- created_by ignored on update usually
                    WHERE id = @id
                `);
            } else {
                const finalStatus = data.status || 'DRAFT';
                const insertRes = await transaction.request()
                    .input('project_id', sql.Int, projectId)
                    .input('period', sql.Date, parsePeriodToSqlDate(period))
                    .input('revenue', sql.Decimal(15, 2), data.revenue)
                    .input('tpc', sql.Decimal(15, 2), data.thirdPartyCosts)
                    .input('user', sql.VarChar, user)
                    .input('status', sql.VarChar, finalStatus)
                    .query(`
                    INSERT INTO MonthlyClosures (project_id, period, status, revenue, third_party_costs, created_by)
                    OUTPUT INSERTED.id
                    VALUES (@project_id, @period, @status, @revenue, @tpc, @user)
                `);
                closureId = insertRes.recordset[0].id;
            }

            // 3. Update Resources (Delete all and Re-insert logic is simplest for full save)
            await transaction.request()
                .input('closure_id', sql.Int, closureId)
                .query('DELETE FROM ClosureResourceHours WHERE closure_id = @closure_id');

            for (const line of data.resources) {
                // Find resource
                const resLookup = await transaction.request()
                    .input('name', sql.VarChar, line.resourceName)
                    .query('SELECT id FROM Resources WHERE resource_name = @name');
                    
                if (resLookup.recordset.length === 0) throw new Error(`Resource ${line.resourceName} not found`);
                const resourceId = resLookup.recordset[0].id;
                
                let directRate = 0;
                let indirectRate = 0;

                if (line.rate !== undefined && line.rate !== null) {
                    directRate = line.rate;
                    indirectRate = 0;
                } else {
                    // Get Rate for Period
                    const rateRes = await transaction.request()
                        .input('r_id', sql.Int, resourceId)
                        .input('period', sql.Date, parsePeriodToSqlDate(period))
                        .query(`
                        SELECT COALESCE(direct_rate, 0) as direct_rate, COALESCE(indirect_rate, 0) as indirect_rate
                        FROM ResourceMonthlyRates 
                        WHERE resource_id = @r_id AND period = @period
                    `);
                    
                    if (rateRes.recordset.length > 0) {
                        directRate = rateRes.recordset[0].direct_rate;
                        indirectRate = rateRes.recordset[0].indirect_rate;
                    }
                }
                // Optional: Block if rate is 0? For now allow, but maybe warn. DRAFT allows it.

                await transaction.request()
                    .input('closure_id', sql.Int, closureId)
                    .input('resource_id', sql.Int, resourceId)
                    .input('hours', sql.Decimal(10, 2), line.hours)
                    .input('direct', sql.Decimal(10, 2), directRate)
                    .input('indirect', sql.Decimal(10, 2), indirectRate)
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
