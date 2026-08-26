import express from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { checkUtrAvailability, createRegistration, registrationStatus } from '../services/registrationService.js';

export const publicRouter = express.Router();

const utrLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false });
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });

publicRouter.get('/health', (_request, response) => response.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'mongo' : 'memory' }));

publicRouter.get('/events', (_request, response) => response.json(registrationStatus()));

publicRouter.post('/utr/check', utrLimiter, async (request, response, next) => {
  try {
    const result = await checkUtrAvailability(request.body?.utrNumber);
    return response.status(result.statusCode).json(result.body);
  } catch (error) {
    return next(error);
  }
});

publicRouter.post('/register', registerLimiter, async (request, response, next) => {
  try {
    const result = await createRegistration(request.body);
    return response.status(result.statusCode).json(result.body);
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ message: error.keyPattern?.normalizedUtr ? 'This UTR has already been submitted.' : 'A duplicate registration was detected.' });
    return next(error);
  }
});
