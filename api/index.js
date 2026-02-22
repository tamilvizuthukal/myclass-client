// api/index.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
const uploadsPath = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
}

// Database connection cache
let dbConnected = false;

const connectToDatabase = async () => {
    if (dbConnected) return;
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is not defined in environment variables');
    }

    try {
        await mongoose.connect(uri);
        dbConnected = true;
    } catch (error) {
        throw error;
    }
};

// Mount routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', async (req, res) => {
    try {
        await connectToDatabase();
        const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        res.json({
            status: 'healthy',
            database: dbState,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error ? (error.message || String(error)) : 'unknown',
            timestamp: new Date().toISOString()
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'My Class Content Browser API',
        version: '1.0.0',
        status: 'running'
    });
});

// Server startup for direct Node.js execution
export const startServer = async () => {
    try {
        const PORT = process.env.PORT || 5002;
        const server = app.listen(PORT, () => {
            // Attempt to connect to DB in background
            connectToDatabase().catch(error => {
                // Silently fail, it will retry on request
            });
        });
        server.setTimeout(5 * 60 * 1000);
    } catch (error) {
        process.exit(1);
    }
};

// Serverless handler used by Vercel
const serverlessHandler = async (req, res) => {
    try {
        await connectToDatabase();
        app(req, res);
    } catch (error) {
        res.status(500).json({
            error: 'Database connection failed',
            message: error ? (error.message || String(error)) : 'unknown'
        });
    }
};

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
    startServer();
}

export default serverlessHandler;
export { app, serverlessHandler };
