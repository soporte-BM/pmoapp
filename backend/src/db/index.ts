import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config: sql.config = {
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

let pool: sql.ConnectionPool | null = null;
let connectingPromise: Promise<sql.ConnectionPool> | null = null;

export const connectDB = async (): Promise<sql.ConnectionPool> => {
    if (pool && pool.connected) {
        return pool;
    }
    if (connectingPromise) {
        return connectingPromise;
    }

    connectingPromise = (async () => {
        try {
            console.log('Connecting to Azure SQL Database...');
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // Ignore close errors on dead pool
                }
            }
            const newPool = new sql.ConnectionPool(config);
            newPool.on('error', (err) => {
                console.error('Unexpected SQL pool error:', err);
                if (!newPool.connected) {
                    pool = null;
                }
            });
            await newPool.connect();
            pool = newPool;
            console.log('Connected to Azure SQL Database successfully');
            return pool;
        } catch (err) {
            pool = null;
            console.error('Database connection failed:', err);
            throw err;
        } finally {
            connectingPromise = null;
        }
    })();

    return connectingPromise;
};

export const getPool = async (): Promise<sql.ConnectionPool> => {
    if (pool && pool.connected) {
        return pool;
    }
    return connectDB();
};
