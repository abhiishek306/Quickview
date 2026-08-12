import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'node:http';
import mongoose from 'mongoose';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import connectDB from './configs/db.js';
import { clerkMiddleware } from '@clerk/express'
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import showRouter from './routes/showRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import adminRouter from './routes/AdminRoutes.js';
import userRouter from './routes/userRoutes.js';
import { stripeWebhooks } from './controllers/stripeWebhook.js';
import { env, getAllowedOrigins } from './configs/env.js';
import { attachRequestContext } from './middleware/requestContext.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandlers.js';
import { initializeSocket } from './socket/socket.js';
import { requestLogger, logger } from './services/logger.js';
import { initializeRedis, closeRedis } from './services/redis.js';
import { initializeSentry } from './monitoring/sentry.js';

dotenv.config({ path: new URL('./.env', import.meta.url) });

const app=express();
const httpServer = http.createServer(app);
const port=env.PORT;
const allowedOrigins = getAllowedOrigins();
const isVercelRuntime = process.env.VERCEL === '1';

app.set('trust proxy', 1);
initializeSentry();
await connectDB();
await initializeRedis();

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again shortly.' },
});

// Stripe webhook must receive raw body and POST only
app.post('/api/stripe',express.raw({type:'application/json'}),stripeWebhooks);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet());
app.use(compression());
app.use(attachRequestContext);
app.use(requestLogger);
app.use('/api', apiLimiter);

app.get('/health/live', (req, res) => {
    res.status(200).json({ success: true, service: 'quickview-api', status: 'live' });
});

app.get('/health/ready', (req, res) => {
    if (env.SKIP_DB_CONNECT) {
        return res.status(200).json({
            success: true,
            service: 'quickview-api',
            status: 'ready',
            checks: {
                mongodb: 'skipped',
            },
        });
    }

    const isMongoReady = mongoose.connection.readyState === 1;
    const statusCode = isMongoReady ? 200 : 503;

    res.status(statusCode).json({
        success: isMongoReady,
        service: 'quickview-api',
        status: isMongoReady ? 'ready' : 'degraded',
        checks: {
            mongodb: isMongoReady ? 'connected' : 'disconnected',
        },
    });
});

app.get('/',(req,res)=>{
    if (env.NODE_ENV === 'production' && env.CLIENT_URL) {
        return res.redirect(env.CLIENT_URL);
    }

    res.send('Server is running');
});
app.use('/api/inngest',serve({ client: inngest, functions }))
app.use('/api/show',showRouter);
app.use('/api/booking', clerkMiddleware(), bookingRouter)
app.use('/api/admin', clerkMiddleware(), adminRouter);
app.use('/api/user', clerkMiddleware(), userRouter);
app.use(notFoundHandler);
app.use(globalErrorHandler);

if (!isVercelRuntime) {
    initializeSocket(httpServer, allowedOrigins);
}

if (!isVercelRuntime) {
    httpServer.listen(port,()=>{
        logger.info({ port }, `Server listening at http://localhost:${port}`);
    });
}

const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Closing HTTP server and database connection...`);
    httpServer.close(async () => {
        try {
            await mongoose.connection.close();
            await closeRedis();
            logger.info('MongoDB and Redis connections closed.');
            process.exit(0);
        } catch (error) {
            logger.error({ error }, 'Error while closing MongoDB/Redis connections');
            process.exit(1);
        }
    });

    setTimeout(() => {
        logger.error('Force shutdown due to timeout.');
        process.exit(1);
    }, 10000).unref();
};

if (!isVercelRuntime) {
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export default app;