import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

async function showAll() {
    try {
        const pool = await sql.connect(config);
        const tables = ['Projects', 'Resources', 'ResourceMonthlyRates', 'MonthlyClosures', 'ClosureResourceHours'];

        for (const table of tables) {
            console.log(`\n=== Data in ${table} ===`);
            try {
                const result = await pool.request().query(`SELECT * FROM ${table}`);
                console.table(result.recordset);
            } catch (err: any) {
                console.log(`Could not query ${table}: ${err.message}`);
            }
        }

        await pool.close();
    } catch (err) {
        console.error('Connection failed:', err);
    }
}

showAll();
