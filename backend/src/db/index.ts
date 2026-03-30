import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config: sql.config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true, // Use this if you're on Azure.
        trustServerCertificate: true, // Change to false for production
    },
};


let pool: sql.ConnectionPool | null = null;
let lastError: any = null;

export const connectDB = async () => {
    try {
        console.log("Connecting to SQL Server with config:", {
            ...config,
            password: config.password ? '***' : undefined
        });
        pool = await sql.connect(config);
        console.log('Connected to Azure SQL Database');
        return pool;
    } catch (err: any) {
        console.error('Database connection failed:', err);
        lastError = err.message || err.toString();
        throw err;
    }
};

export const getPool = () => {
    if (!pool) {
        throw new Error(`Database not connected. Reason: ${lastError || 'Unknown'}`);
    }
    return pool;
};
