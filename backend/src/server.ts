import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './db';
import projectRoutes from './routes/projectRoutes';
import resourceRoutes from './routes/resourceRoutes';
import rateRoutes from './routes/rateRoutes';
import closureRoutes from './routes/closureRoutes';

import path from 'path';

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Opcional, dependiendo de si tus estáticos fallan por CSP
}));
app.use(cors({
    origin: isProduction && process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN : '*'
}));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json());

// Serve static frontend files (if deployed monolithically)
const frontendRoot = path.join(__dirname, '../../');
app.get('/', (req, res) => res.sendFile(path.join(frontendRoot, 'index.html')));
app.use('/assets', express.static(path.join(frontendRoot, 'assets')));
app.use('/styles', express.static(path.join(frontendRoot, 'styles')));
app.use('/src', express.static(path.join(frontendRoot, 'src')));

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/closures', closureRoutes);

// Health Check
import { Request, Response } from "express";

app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ 
        ok: true, 
        service: 'pmoapp-backend', 
        timestamp: new Date().toISOString() 
    });
});

// Database ping / warm-up endpoint (useful for keep-alive crons or monitoring)
app.get("/health/db", async (req: Request, res: Response) => {
    try {
        const pool = await connectDB();
        res.status(200).json({ ok: true, dbConnected: pool.connected });
    } catch (error: any) {
        res.status(503).json({ ok: false, error: error.message || 'Database unavailable' });
    }
});

// Start Server
const startServer = async () => {
    try {
        await connectDB();
        console.log("Database connected successfully");
    } catch (error) {
        console.warn("⚠️ Initial DB connection timed out or database paused. Auto-reconnection enabled on incoming requests.");
    }

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();


