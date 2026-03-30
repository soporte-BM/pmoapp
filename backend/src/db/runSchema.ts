import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { connectDB } from './index';
import dotenv from 'dotenv';
dotenv.config();

const runSchema = async () => {
    try {
        const pool = await connectDB();
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        // mssql package might fail trying to run GO batches, so we split by GO
        const queries = schemaSql.split(/GO\b/i).map(q => q.trim()).filter(q => q.length > 0);
        
        for (const query of queries) {
            console.log("Executing batch...");
            await pool.request().query(query);
        }
        
        console.log("Database schema initialized successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error initializing schema:", err);
        process.exit(1);
    }
};

runSchema();
