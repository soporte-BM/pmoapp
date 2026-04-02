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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateRepository = void 0;
const mssql_1 = __importDefault(require("mssql"));
const db_1 = require("../db");
exports.RateRepository = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        const result = yield pool.request()
            .query(`
        SELECT r.id as resource_id, r.resource_name, rr.period, rr.direct_rate, rr.indirect_rate, rr.currency
        FROM Resources r
        LEFT JOIN ResourceMonthlyRates rr ON r.id = rr.resource_id
        WHERE r.status = 'ACTIVE'
      `);
        return result.recordset;
    }),
    getByPeriod: (period) => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        const result = yield pool.request()
            .input('period', mssql_1.default.Date, period)
            .query(`
        SELECT r.id as resource_id, r.resource_name, rr.direct_rate, rr.indirect_rate, rr.currency
        FROM Resources r
        LEFT JOIN ResourceMonthlyRates rr ON r.id = rr.resource_id AND rr.period = @period
        WHERE r.status = 'ACTIVE'
      `);
        return result.recordset;
    }),
    upsertRate: (resourceName, period, directRate, indirectRate) => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        const transaction = new mssql_1.default.Transaction(pool);
        try {
            yield transaction.begin();
            // 1. Get resource ID or fail
            const resourceResult = yield transaction.request()
                .input('name', mssql_1.default.VarChar, resourceName)
                .query('SELECT id FROM Resources WHERE resource_name = @name');
            if (resourceResult.recordset.length === 0) {
                throw new Error(`Resource ${resourceName} not found`);
            }
            const resourceId = resourceResult.recordset[0].id;
            // 2. Upsert Rate
            // Check if exists
            const rateCheck = yield transaction.request()
                .input('resource_id', mssql_1.default.Int, resourceId)
                .input('period', mssql_1.default.Date, period)
                .query('SELECT id FROM ResourceMonthlyRates WHERE resource_id = @resource_id AND period = @period');
            if (rateCheck.recordset.length > 0) {
                // Update
                yield transaction.request()
                    .input('resource_id', mssql_1.default.Int, resourceId)
                    .input('period', mssql_1.default.Date, period)
                    .input('direct', mssql_1.default.Decimal(10, 2), directRate)
                    .input('indirect', mssql_1.default.Decimal(10, 2), indirectRate)
                    .query(`
                    UPDATE ResourceMonthlyRates 
                    SET direct_rate = @direct, indirect_rate = @indirect, updated_at = GETDATE()
                    WHERE resource_id = @resource_id AND period = @period
                `);
            }
            else {
                // Insert
                yield transaction.request()
                    .input('resource_id', mssql_1.default.Int, resourceId)
                    .input('period', mssql_1.default.Date, period)
                    .input('direct', mssql_1.default.Decimal(10, 2), directRate)
                    .input('indirect', mssql_1.default.Decimal(10, 2), indirectRate)
                    .query(`
                    INSERT INTO ResourceMonthlyRates (resource_id, period, direct_rate, indirect_rate)
                    VALUES (@resource_id, @period, @direct, @indirect)
                `);
            }
            yield transaction.commit();
            return { resourceName, status: 'updated' };
        }
        catch (err) {
            yield transaction.rollback();
            throw err;
        }
    }),
    // Batch upsert could be optimized but loop for now is safer for transaction logic simplicity in this context
};
