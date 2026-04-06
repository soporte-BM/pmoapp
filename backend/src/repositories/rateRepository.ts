import sql from 'mssql';
import { getPool } from '../db';
import { ResourceRepository } from './resourceRepository';

export interface Rate {
    id?: number;
    resource_id: number;
    period: string; // YYYY-MM-01
    direct_rate: number;
    indirect_rate: number;
    currency: string;
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

export const RateRepository = {
    getAll: async () => {
        const pool = getPool();
        const result = await pool.request()
            .query(`
        SELECT r.id as resource_id, r.resource_name, rr.period, rr.direct_rate, rr.indirect_rate, rr.currency
        FROM Resources r
        LEFT JOIN ResourceMonthlyRates rr ON r.id = rr.resource_id
        WHERE r.status = 'ACTIVE'
      `);
        return result.recordset;
    },

    getByPeriod: async (period: string) => {
        const pool = getPool();
        const result = await pool.request()
            .input('period', sql.Date, parsePeriodToSqlDate(period))
            .query(`
        SELECT r.id as resource_id, r.resource_name, rr.direct_rate, rr.indirect_rate, rr.currency
        FROM Resources r
        LEFT JOIN ResourceMonthlyRates rr ON r.id = rr.resource_id AND rr.period = @period
        WHERE r.status = 'ACTIVE'
      `);
        return result.recordset;
    },

    upsertRate: async (resourceName: string, period: string, directRate: number, indirectRate: number) => {
        const pool = getPool();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            // 1. Get resource ID or fail
            const resourceResult = await transaction.request()
                .input('name', sql.VarChar, resourceName)
                .query('SELECT id FROM Resources WHERE resource_name = @name');

            if (resourceResult.recordset.length === 0) {
                throw new Error(`Resource ${resourceName} not found`);
            }
            const resourceId = resourceResult.recordset[0].id;

            // 2. Upsert Rate
            // Check if exists
            const rateCheck = await transaction.request()
                .input('resource_id', sql.Int, resourceId)
                .input('period', sql.Date, parsePeriodToSqlDate(period))
                .query('SELECT id FROM ResourceMonthlyRates WHERE resource_id = @resource_id AND period = @period');

            if (rateCheck.recordset.length > 0) {
                // Update
                await transaction.request()
                    .input('resource_id', sql.Int, resourceId)
                    .input('period', sql.Date, parsePeriodToSqlDate(period))
                    .input('direct', sql.Decimal(10, 2), directRate)
                    .input('indirect', sql.Decimal(10, 2), indirectRate)
                    .query(`
                    UPDATE ResourceMonthlyRates 
                    SET direct_rate = @direct, indirect_rate = @indirect, updated_at = GETDATE()
                    WHERE resource_id = @resource_id AND period = @period
                `);
            } else {
                // Insert
                await transaction.request()
                    .input('resource_id', sql.Int, resourceId)
                    .input('period', sql.Date, parsePeriodToSqlDate(period))
                    .input('direct', sql.Decimal(10, 2), directRate)
                    .input('indirect', sql.Decimal(10, 2), indirectRate)
                    .query(`
                    INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
                    VALUES (@resource_id, @period, @direct, @indirect)
                `);
            }

            await transaction.commit();
            return { resourceName, status: 'updated' };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    },

    // Batch upsert could be optimized but loop for now is safer for transaction logic simplicity in this context

    deleteRate: async (resourceId: number, period: string) => {
        const pool = getPool();
        const sqlDate = parsePeriodToSqlDate(period);
        await pool.request()
            .input('resource_id', sql.Int, resourceId)
            .input('period', sql.Date, sqlDate)
            .query('DELETE FROM ResourceMonthlyRates WHERE resource_id = @resource_id AND period = @period');
    }
};
