import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { adminRouter } from './routes/adminRoutes.js';
import { organizerRouter } from './routes/organizerRoutes.js';
import { publicRouter } from './routes/publicRoutes.js';

export function createApp() {
  const app = express();
  const origins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim());

  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); } }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '350kb' }));

  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', organizerRouter);
  app.use(errorHandler);

  return app;
}
