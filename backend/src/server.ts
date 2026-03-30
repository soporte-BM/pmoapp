import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './db';
import projectRoutes from './routes/projectRoutes';
import resourceRoutes from './routes/resourceRoutes';
import rateRoutes from './routes/rateRoutes';
import closureRoutes from './routes/closureRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/closures', closureRoutes);

// Health Check
import { Request, Response } from "express";
// ...
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ ok: true });
});

// Serve frontend static files
// We use process.cwd() because Azure Linux mounts can break __dirname relative pathing
const frontendPath = path.resolve(process.cwd());
app.use(express.static(frontendPath));

// Handle any other routes by serving the index.html
app.use((req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});


// Start Server
const startServer = async () => {
    try {
        await connectDB();
        console.log("Database connected successfully");
    } catch (error) {
        console.warn("⚠️ Database not available. Running in DEV mode without DB.");
    }

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();


