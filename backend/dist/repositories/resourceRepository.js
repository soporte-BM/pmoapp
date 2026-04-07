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
exports.ResourceRepository = void 0;
const mssql_1 = __importDefault(require("mssql"));
const db_1 = require("../db");
exports.ResourceRepository = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        const result = yield pool.request().query('SELECT * FROM Resources');
        return result.recordset;
    }),
    create: (resource) => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        const result = yield pool.request()
            .input('resource_name', mssql_1.default.VarChar, resource.resource_name)
            .input('role', mssql_1.default.VarChar, resource.role)
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
    }),
    update: (id, newName) => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        // Evitamos inyección cambiando solo si no existe otro con ese nombre o si es el mismo
        yield pool.request()
            .input('id', mssql_1.default.Int, id)
            .input('name', mssql_1.default.VarChar, newName)
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
    }),
    softDelete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const pool = (0, db_1.getPool)();
        yield pool.request()
            .input('id', mssql_1.default.Int, id)
            .query(`UPDATE Resources SET status = 'INACTIVE', updated_at = GETDATE() WHERE id = @id`);
    })
};
