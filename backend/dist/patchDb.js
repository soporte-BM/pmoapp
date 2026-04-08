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
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./db/index");
const patchDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Connecting to database...');
        const pool = yield (0, index_1.connectDB)();
        console.log('Running ALTER TABLE commands...');
        // 1. Ampliar columnas en la tabla de Tarifas Mensuales
        yield pool.request().query(`
            ALTER TABLE ResourceMonthlyRates ALTER COLUMN direct_rate DECIMAL(15, 2) NOT NULL;
            ALTER TABLE ResourceMonthlyRates ALTER COLUMN indirect_rate DECIMAL(15, 2) NOT NULL;
        `);
        console.log('ResourceMonthlyRates updated successfully.');
        // 2. Ampliar columnas en la tabla del historial de los cierres
        yield pool.request().query(`
            ALTER TABLE ClosureResourceHours ALTER COLUMN rate_snapshot_direct DECIMAL(15, 2) NOT NULL;
            ALTER TABLE ClosureResourceHours ALTER COLUMN rate_snapshot_indirect DECIMAL(15, 2) NOT NULL;
        `);
        console.log('ClosureResourceHours updated successfully.');
        console.log('Database patching complete.');
        process.exit(0);
    }
    catch (err) {
        console.error('Error patching database:', err);
        process.exit(1);
    }
});
patchDatabase();
