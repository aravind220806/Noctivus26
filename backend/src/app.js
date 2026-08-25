import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { eventCatalog } from './events.js';
import { Registration } from './model.js';
import { normalizeDigits, validateRegistration } from './validation.js';

const memoryRegistrations = [];
const id = () => `NOC26-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export function createApp() {
  const app = express();
  const origins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim());
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); } }));
  app.use(express.json({ limit: '40kb' }));

  app.get('/api/health', (_request, response) => response.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'mongo' : 'memory' }));
  app.get('/api/events', (_request, response) => {
    const registrationOpen = process.env.REGISTRATION_OPEN === 'true' && eventCatalog.every((event) => event.detailsComplete);
    response.json({
      registrationOpen,
      events: eventCatalog.map((event) => ({
        ...event,
        status: registrationOpen ? 'open' : 'opening-soon',
      })),
    });
  });

  app.post('/api/utr/check', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false }), async (request, response, next) => {
    try {
      const utrNumber = normalizeDigits(request.body?.utrNumber);
      if (!/^\d{12}$/.test(utrNumber)) return response.status(400).json({ available: false, message: 'Enter exactly 12 digits.' });

      let duplicate;
      if (mongoose.connection.readyState === 1) duplicate = Boolean(await Registration.exists({ normalizedUtr: utrNumber }));
      else {
        if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MEMORY_DB !== 'true') return response.status(503).json({ available: false, message: 'UTR verification is temporarily unavailable.' });
        duplicate = memoryRegistrations.some((item) => item.normalizedUtr === utrNumber);
      }

      return response.json({ available: !duplicate, message: duplicate ? 'This UTR has already been submitted.' : 'UTR is available.' });
    } catch (error) { return next(error); }
  });

  app.post('/api/register', rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false }), async (request, response, next) => {
    try {
      if (process.env.REGISTRATION_OPEN !== 'true' || eventCatalog.some((event) => !event.detailsComplete)) return response.status(403).json({ message: 'Registration is not open yet.' });
      const result = validateRegistration(request.body);
      if (!result.valid) return response.status(400).json({ message: result.errors[0], errors: result.errors });
      const eventIds = result.value.eventRegistrations.map((event) => event.eventId);
      const record = { registrationId: id(), ...result.value, paymentStatus: 'pending', paymentSubmittedAt: new Date() };

      if (mongoose.connection.readyState === 1) {
        const duplicate = await Registration.exists({ 'normalized.email': result.value.normalized.email, 'eventRegistrations.eventId': { $in: eventIds } });
        if (duplicate) return response.status(409).json({ message: 'This email is already registered for one of the selected events.' });
        await Registration.create(record);
      } else {
        if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MEMORY_DB !== 'true') return response.status(503).json({ message: 'Registration service is not connected to its database.' });
        const duplicateEvent = memoryRegistrations.some((item) => item.normalized.email === result.value.normalized.email && item.eventRegistrations.some((event) => eventIds.includes(event.eventId)));
        if (duplicateEvent) return response.status(409).json({ message: 'This email is already registered for one of the selected events.' });
        if (memoryRegistrations.some((item) => item.normalizedUtr === result.value.normalizedUtr)) return response.status(409).json({ message: 'This UTR has already been submitted.' });
        memoryRegistrations.push(record);
      }

      return response.status(201).json({ registrationId: record.registrationId, status: 'pending', expectedAmount: record.expectedAmount, message: 'Registration received and awaiting payment verification.' });
    } catch (error) {
      if (error?.code === 11000) return response.status(409).json({ message: error.keyPattern?.normalizedUtr ? 'This UTR has already been submitted.' : 'A duplicate registration was detected.' });
      return next(error);
    }
  });

  app.patch('/api/registrations/:id', async (request, response, next) => {
    try {
      const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!process.env.ORGANIZER_SECRET || provided !== process.env.ORGANIZER_SECRET) return response.status(401).json({ message: 'Organizer authorization required.' });
      const allowed = ['confirmed', 'mismatch', 'duplicate'];
      if (!allowed.includes(request.body.status)) return response.status(400).json({ message: 'Invalid registration status.' });
      const update = { paymentStatus: request.body.status, verifiedAt: new Date(), verifiedBy: 'organizer-api', verificationNotes: String(request.body.notes || '').slice(0, 500) };
      let registration;
      if (mongoose.connection.readyState === 1) registration = await Registration.findOneAndUpdate({ registrationId: request.params.id }, update, { new: true });
      else {
        registration = memoryRegistrations.find((item) => item.registrationId === request.params.id);
        if (registration) Object.assign(registration, update);
      }
      if (!registration) return response.status(404).json({ message: 'Registration not found.' });
      if (update.paymentStatus === 'confirmed') await sendConfirmation(registration);
      return response.json({ registrationId: registration.registrationId, status: registration.paymentStatus });
    } catch (error) { return next(error); }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ message: 'An unexpected server error occurred.' });
  });
  return app;
}

async function sendConfirmation(registration) {
  if (!process.env.RESEND_API_KEY || !process.env.CONFIRM_FROM) return;
  const participant = registration.participant;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONFIRM_FROM,
      to: participant.email,
      subject: `Noctivus '26 registration confirmed — ${registration.registrationId}`,
      html: `<h1>You're confirmed, ${escapeHtml(participant.name)}.</h1><p>Your Noctivus '26 registration <strong>${escapeHtml(registration.registrationId)}</strong> is confirmed.</p>`,
    }),
  });
}

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
