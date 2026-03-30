const sql = require('mssql');
require('dotenv').config();

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

async function checkDb() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Resources'
        `);
        console.log("COLUMNS:");
        console.log(JSON.stringify(result.recordset, null, 2));

        const keys = await pool.request().query(`
            SELECT tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME, kcu.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
              ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
            WHERE tc.TABLE_NAME = 'Resources'
        `);
        console.log("CONSTRAINTS:");
        console.log(JSON.stringify(keys.recordset, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDb();
