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
exports.getPool = exports.connectDB = void 0;
const mssql_1 = __importDefault(require("mssql"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE,
    connectionTimeout: 60000, // 60s to allow Azure SQL Serverless auto-resume without ETIMEOUT
    requestTimeout: 60000,
    options: {
        encrypt: true, // Use this if you're on Azure.
        trustServerCertificate: true, // Change to false for production
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0, // min: 0 prevents stale connections when Azure SQL Serverless pauses
        idleTimeoutMillis: 30000 // Prevent Azure from silently dropping half-open sockets
    }
};
let pool = null;
let connectingPromise = null;
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    if (pool && pool.connected) {
        return pool;
    }
    if (connectingPromise) {
        return connectingPromise;
    }
    connectingPromise = (() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            console.log('Connecting to Azure SQL Database...');
            if (pool) {
                try {
                    yield pool.close();
                }
                catch (_a) {
                    // Ignore close errors on dead pool
                }
            }
            const newPool = new mssql_1.default.ConnectionPool(config);
            newPool.on('error', (err) => {
                console.error('Unexpected SQL pool error:', err);
                if (!newPool.connected) {
                    pool = null;
                }
            });
            yield newPool.connect();
            pool = newPool;
            console.log('Connected to Azure SQL Database successfully');
            return pool;
        }
        catch (err) {
            pool = null;
            console.error('Database connection failed:', err);
            throw err;
        }
        finally {
            connectingPromise = null;
        }
    }))();
    return connectingPromise;
});
exports.connectDB = connectDB;
const getPool = () => __awaiter(void 0, void 0, void 0, function* () {
    if (pool && pool.connected) {
        return pool;
    }
    return (0, exports.connectDB)();
});
exports.getPool = getPool;
