// api/index.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load api/.env relative to this file so the server behaves the same
// regardless of the directory it was launched from. `dotenv/config`
// resolves against process.cwd(), which silently produced PORT=undefined
// (fallback port) and MONGODB_URI=undefined when started from the repo root.
dotenv.config({ path: path.join(__dirname, '.env') });

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
let dbConnecting = null;

mongoose.connection.on('error', (err) => {
    console.error('[mongodb] connection error:', err.message);
});
mongoose.connection.on('disconnected', () => {
    dbConnected = false;
    console.warn('[mongodb] disconnected');
});

const connectToDatabase = async () => {
    if (dbConnected) return;
    if (dbConnecting) return dbConnecting;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error(
            'MONGODB_URI is not defined. Expected it in ' + path.join(__dirname, '.env')
        );
    }

    dbConnecting = mongoose.connect(uri)
        .then(() => {
            dbConnected = true;
            console.log('[mongodb] connected to', uri.replace(/\/\/([^@]+)@/, '//***@'));
            return mongoose.connection;
        })
        .catch((error) => {
            dbConnected = false;
            console.error('[mongodb] connection failed:', error.message);
            throw error;
        })
        .finally(() => {
            dbConnecting = null;
        });

    return dbConnecting;
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
    const PORT = process.env.PORT || 5001;
    try {
        const server = app.listen(PORT, () => {
            console.log(`[server] listening on port ${PORT}`);
            // Attempt to connect to DB in background
            connectToDatabase().catch((error) => {
                // Logged in connectToDatabase; requests will retry the connection.
                console.error('[server] startup DB connection failed:', error.message);
            });
        });
        server.on('error', (error) => {
            console.error('[server] failed to start:', error.message);
            process.exit(1);
        });
        server.setTimeout(5 * 60 * 1000);
    } catch (error) {
        console.error('[server] failed to start:', error.message);
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
