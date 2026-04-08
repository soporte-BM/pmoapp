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
exports.ProjectRepository = void 0;
const mssql_1 = __importDefault(require("mssql"));
const db_1 = require("../db");
exports.ProjectRepository = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        const result = yield pool.request().query('SELECT * FROM Projects');
        return result.recordset;
    }),
    create: (project) => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        let status = project.status || 'ACTIVE';
        let manager = project.manager || null;
        const result = yield pool.request()
            .input('project_code', mssql_1.default.VarChar, project.project_code)
            .input('name', mssql_1.default.VarChar, project.name)
            .input('manager', mssql_1.default.VarChar, manager)
            .input('status', mssql_1.default.VarChar, status)
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
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        const transaction = new mssql_1.default.Transaction(pool);
        try {
            yield transaction.begin();
            const request = new mssql_1.default.Request(transaction);
            // Delete associated resource hours
            yield request.query(`
                DELETE FROM ClosureResourceHours 
                WHERE closure_id IN (SELECT id FROM MonthlyClosures WHERE project_id = ${id})
            `);
            // Delete associated closures
            yield request.query(`DELETE FROM MonthlyClosures WHERE project_id = ${id}`);
            // Delete project
            const result = yield request.query(`DELETE FROM Projects WHERE id = ${id}`);
            yield transaction.commit();
            return result.rowsAffected[0] > 0;
        }
        catch (error) {
            yield transaction.rollback();
            throw error;
        }
    }),
};
