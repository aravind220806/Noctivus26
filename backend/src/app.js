import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { eventCatalog } from './events.js';
import { AdminAccess, Registration } from './model.js';
import { normalizeDigits, validateRegistration } from './validation.js';

const memoryRegistrations = [];
const memoryAdminAccess = [];
const id = () => `NOC26-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const sessionTtlMs = 8 * 60 * 60 * 1000;
const adminTabs = ['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export', 'Admin Access'];
const registrationAdminProjection = {
  _id: 0,
  __v: 0,
  normalized: 0,
  normalizedUtr: 0,
  consent: 0,
};
const adminAccessProjection = { _id: 0, __v: 0 };

export function createApp() {
  const app = express();
  const origins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim());
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); } }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '350kb' }));

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

  app.post('/api/admin/auth/google', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }), async (request, response, next) => {
    try {
      const credential = String(request.body?.credential || '');
      if (!credential) return response.status(400).json({ message: 'Google credential is required.' });
      if (!process.env.GOOGLE_CLIENT_ID) return response.status(503).json({ message: 'Google OAuth is not configured on the server.' });

      const profile = await verifyGoogleCredential(credential);
      if (!profile.email || !profile.email_verified) return response.status(401).json({ message: 'Use a verified Google account.' });
      const access = await resolveAdminAccess(profile.email);
      if (!access) return response.status(403).json({ message: 'This Google account is not allowed for admin access.' });

      const user = { email: profile.email, name: profile.name || profile.email, picture: profile.picture || '', tabs: access.tabs, owner: access.owner };
      return response.json({ token: signAdminToken(user), user });
    } catch (error) { return next(error); }
  });

  app.get('/api/admin/me', requireAdmin, async (request, response) => {
    response.json({ user: request.admin, tabs: request.admin.tabs });
  });

  app.get('/api/admin/access', requireAdminTab('Admin Access'), async (_request, response, next) => {
    try {
      response.json({ users: await listAdminAccess(), tabs: adminTabs.filter((tab) => tab !== 'Admin Access') });
    } catch (error) { next(error); }
  });

  app.put('/api/admin/access/:email', requireAdminTab('Admin Access'), async (request, response, next) => {
    try {
      const email = String(request.params.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return response.status(400).json({ message: 'Enter a valid email address.' });
      if (isOwnerAdmin(email)) return response.status(400).json({ message: 'Owner access is controlled from ADMIN_EMAILS.' });
      const tabs = normalizeAdminTabs(request.body.tabs);
      if (!tabs.length) return response.status(400).json({ message: 'Select at least one tab.' });
      const user = await upsertAdminAccess({ email, name: request.body.name, tabs, active: request.body.active !== false, actor: request.admin.email });
      response.json({ user });
    } catch (error) { next(error); }
  });

  app.delete('/api/admin/access/:email', requireAdminTab('Admin Access'), async (request, response, next) => {
    try {
      const email = String(request.params.email || '').trim().toLowerCase();
      if (isOwnerAdmin(email)) return response.status(400).json({ message: 'Owner access is controlled from ADMIN_EMAILS.' });
      await deactivateAdminAccess(email, request.admin.email);
      response.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.get('/api/admin/overview', requireAnyAdminTab(['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export']), async (_request, response, next) => {
    try {
      const registrations = await loadRegistrations();
      response.json(buildOverview(registrations));
    } catch (error) { next(error); }
  });

  app.get('/api/admin/registrations', requireAnyAdminTab(['Verify Members', 'Invitations', 'Export']), async (request, response, next) => {
    try {
      const registrations = await loadRegistrations({ eventId: request.query.eventId, status: request.query.status });
      response.json({ registrations: registrations.map(serializeRegistration) });
    } catch (error) { next(error); }
  });

  app.patch('/api/admin/registrations/:id/verify', requireAdminTab('Verify Members'), async (request, response, next) => {
    try {
      const allowed = ['confirmed', 'mismatch', 'duplicate'];
      if (!allowed.includes(request.body.status)) return response.status(400).json({ message: 'Invalid registration status.' });
      const update = { paymentStatus: request.body.status, verifiedAt: new Date(), verifiedBy: request.admin.email, verificationNotes: String(request.body.notes || '').slice(0, 500) };
      const registration = await updateRegistration(request.params.id, update);
      if (!registration) return response.status(404).json({ message: 'Registration not found.' });
      if (update.paymentStatus === 'confirmed' && request.body.sendEmail !== false) await sendConfirmation(registration);
      response.json({ registration: serializeRegistration(registration) });
    } catch (error) { next(error); }
  });

  app.post('/api/admin/invitations/send', requireAdminTab('Invitations'), async (request, response, next) => {
    try {
      const registrationIds = Array.isArray(request.body.registrationIds) ? request.body.registrationIds.map(String).slice(0, 200) : [];
      if (!registrationIds.length) return response.status(400).json({ message: 'Select at least one member.' });
      const pass = normalizePassTemplate(request.body.pass || {});
      const all = await loadRegistrations();
      const selected = all.filter((registration) => registrationIds.includes(registration.registrationId));
      if (!selected.length) return response.status(404).json({ message: 'No matching registrations found.' });

      let sent = 0;
      for (const registration of selected) {
        await sendInvitation(registration, pass);
        await updateRegistration(registration.registrationId, {
          invitation: { sentAt: new Date(), sentBy: request.admin.email, passTitle: pass.title, passFields: pass.fields },
        });
        sent += 1;
      }
      response.json({ sent });
    } catch (error) { next(error); }
  });

  app.get('/api/admin/export', requireAdminTab('Export'), async (request, response, next) => {
    try {
      const registrations = await loadRegistrations({ eventId: request.query.eventId, status: request.query.status });
      const csv = registrationsToCsv(registrations);
      response.type('text/csv').set('Content-Disposition', `attachment; filename="noctivus-${request.query.eventId || 'all'}-registrations.csv"`).send(csv);
    } catch (error) { next(error); }
  });

  app.post('/api/admin/analysis/ai', requireAdminTab('AI Analysis'), async (_request, response, next) => {
    try {
      const registrations = await loadRegistrations();
      const overview = buildOverview(registrations);
      const analysis = await createAiAnalysis(overview);
      response.json({ analysis, generatedAt: new Date().toISOString(), mode: 'offline' });
    } catch (error) { next(error); }
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
    response.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'An unexpected server error occurred.' });
  });
  return app;
}

async function verifyGoogleCredential(credential) {
  const params = new URLSearchParams({ id_token: credential });
  const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?${params.toString()}`);
  const profile = await googleResponse.json().catch(() => ({}));
  if (!googleResponse.ok) throw Object.assign(new Error(profile.error_description || 'Google sign-in verification failed.'), { statusCode: 401 });
  if (profile.aud !== process.env.GOOGLE_CLIENT_ID) throw Object.assign(new Error('Google credential audience does not match this app.'), { statusCode: 401 });
  return profile;
}

function isAllowedAdmin(email) {
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowed.length > 0 && allowed.includes(String(email).toLowerCase());
}

function isOwnerAdmin(email) {
  return isAllowedAdmin(email);
}

async function resolveAdminAccess(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  if (isOwnerAdmin(normalizedEmail)) return { email: normalizedEmail, tabs: adminTabs, owner: true, active: true };

  let access;
  if (mongoose.connection.readyState === 1) access = await AdminAccess.findOne({ email: normalizedEmail, active: true }, adminAccessProjection).lean();
  else access = memoryAdminAccess.find((item) => item.email === normalizedEmail && item.active);
  if (!access) return null;
  const tabs = normalizeAdminTabs(access.tabs);
  if (!tabs.length) return null;
  return { email: normalizedEmail, tabs, owner: false, active: true };
}

async function listAdminAccess() {
  const ownerUsers = ownerEmails().map((email) => ({ email, name: 'Owner admin', tabs: adminTabs, active: true, owner: true }));
  let delegated;
  if (mongoose.connection.readyState === 1) delegated = await AdminAccess.find({}, adminAccessProjection).sort({ updatedAt: -1 }).lean();
  else delegated = [...memoryAdminAccess].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return [
    ...ownerUsers,
    ...delegated.map((item) => ({
      email: item.email,
      name: item.name || '',
      tabs: normalizeAdminTabs(item.tabs),
      active: item.active !== false,
      owner: false,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
    })),
  ];
}

async function upsertAdminAccess({ email, name, tabs, active, actor }) {
  const record = { email, name: String(name || '').slice(0, 80), tabs, active, updatedBy: actor };
  if (mongoose.connection.readyState === 1) {
    const user = await AdminAccess.findOneAndUpdate(
      { email },
      { $set: record, $setOnInsert: { createdBy: actor } },
      { new: true, upsert: true, lean: true },
    );
    return { ...user, tabs: normalizeAdminTabs(user.tabs), owner: false };
  }
  const existing = memoryAdminAccess.find((item) => item.email === email);
  if (existing) Object.assign(existing, record, { updatedAt: new Date() });
  else memoryAdminAccess.push({ ...record, createdBy: actor, createdAt: new Date(), updatedAt: new Date() });
  const user = existing || memoryAdminAccess[memoryAdminAccess.length - 1];
  return { ...user, tabs: normalizeAdminTabs(user.tabs), owner: false };
}

async function deactivateAdminAccess(email, actor) {
  if (mongoose.connection.readyState === 1) {
    await AdminAccess.findOneAndUpdate({ email }, { active: false, updatedBy: actor }, { upsert: false });
    return;
  }
  const existing = memoryAdminAccess.find((item) => item.email === email);
  if (existing) Object.assign(existing, { active: false, updatedBy: actor, updatedAt: new Date() });
}

function ownerEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function normalizeAdminTabs(tabs) {
  const allowed = new Set(adminTabs);
  return [...new Set((Array.isArray(tabs) ? tabs : []).map(String).filter((tab) => allowed.has(tab)))];
}

function signAdminToken(user) {
  const secret = adminTokenSecret();
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + sessionTtlMs })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', adminTokenSecret()).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.exp || Date.now() > data.exp) return null;
  return { email: data.email, name: data.name, picture: data.picture, tabs: normalizeAdminTabs(data.tabs), owner: data.owner === true };
}

function adminTokenSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ORGANIZER_SECRET || 'development-admin-session-secret';
}

async function requireAdmin(request, response, next) {
  try {
    const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const admin = verifyAdminToken(provided);
    if (!admin) return response.status(401).json({ message: 'Admin authorization required.' });
    const access = await resolveAdminAccess(admin.email);
    if (!access) return response.status(403).json({ message: 'This admin account no longer has access.' });
    request.admin = { ...admin, tabs: access.tabs, owner: access.owner };
    return next();
  } catch {
    return response.status(401).json({ message: 'Admin authorization required.' });
  }
}

function requireAdminTab(tab) {
  return (request, response, next) => requireAdmin(request, response, () => {
    if (!request.admin.tabs?.includes(tab)) return response.status(403).json({ message: `${tab} access required.` });
    return next();
  });
}

function requireAnyAdminTab(tabs) {
  return (request, response, next) => requireAdmin(request, response, () => {
    if (!tabs.some((tab) => request.admin.tabs?.includes(tab))) return response.status(403).json({ message: 'This admin action is not allowed for your account.' });
    return next();
  });
}

async function loadRegistrations(filters = {}) {
  let registrations;
  if (mongoose.connection.readyState === 1) registrations = await Registration.find(registrationQuery(filters), registrationAdminProjection).sort({ createdAt: -1 }).lean();
  else registrations = [...memoryRegistrations].sort((a, b) => new Date(b.createdAt || b.paymentSubmittedAt || 0) - new Date(a.createdAt || a.paymentSubmittedAt || 0));
  if (mongoose.connection.readyState !== 1 && filters.eventId) registrations = registrations.filter((registration) => registration.eventRegistrations?.some((event) => event.eventId === filters.eventId));
  if (mongoose.connection.readyState !== 1 && filters.status) registrations = registrations.filter((registration) => registration.paymentStatus === filters.status);
  return registrations;
}

function registrationQuery(filters = {}) {
  const query = {};
  if (filters.eventId) query['eventRegistrations.eventId'] = filters.eventId;
  if (filters.status) query.paymentStatus = filters.status;
  return query;
}

async function updateRegistration(registrationId, update) {
  if (mongoose.connection.readyState === 1) return Registration.findOneAndUpdate({ registrationId }, update, { new: true, lean: true, projection: registrationAdminProjection });
  const registration = memoryRegistrations.find((item) => item.registrationId === registrationId);
  if (!registration) return null;
  Object.assign(registration, update);
  return registration;
}

function serializeRegistration(registration) {
  return {
    registrationId: registration.registrationId,
    participant: registration.participant,
    eventRegistrations: registration.eventRegistrations,
    paymentStatus: registration.paymentStatus,
    utrNumber: registration.utrNumber,
    paymentReference: registration.paymentReference,
    expectedAmount: registration.expectedAmount,
    claimedAmount: registration.claimedAmount,
    paymentSubmittedAt: registration.paymentSubmittedAt,
    verifiedAt: registration.verifiedAt,
    verifiedBy: registration.verifiedBy,
    verificationNotes: registration.verificationNotes,
    invitation: registration.invitation,
    createdAt: registration.createdAt,
  };
}

function buildOverview(registrations) {
  const statuses = { pending: 0, confirmed: 0, mismatch: 0, duplicate: 0 };
  const events = new Map(eventCatalog.map((event) => [event.id, { eventId: event.id, eventName: event.name, category: event.category, registrations: 0, confirmed: 0, pending: 0, revenue: 0 }]));
  let expectedRevenue = 0;
  let confirmedRevenue = 0;
  registrations.forEach((registration) => {
    statuses[registration.paymentStatus] = (statuses[registration.paymentStatus] || 0) + 1;
    expectedRevenue += Number(registration.expectedAmount || 0);
    if (registration.paymentStatus === 'confirmed') confirmedRevenue += Number(registration.expectedAmount || 0);
    registration.eventRegistrations?.forEach((entry) => {
      const row = events.get(entry.eventId) || { eventId: entry.eventId, eventName: entry.eventName || entry.eventId, category: entry.category || '', registrations: 0, confirmed: 0, pending: 0, revenue: 0 };
      row.registrations += 1;
      if (registration.paymentStatus === 'confirmed') {
        row.confirmed += 1;
        row.revenue += Number(entry.feeSnapshot || registration.expectedAmount || 0);
      }
      if (registration.paymentStatus === 'pending') row.pending += 1;
      events.set(entry.eventId, row);
    });
  });
  const recent = registrations.slice(0, 8).map(serializeRegistration);
  return { total: registrations.length, statuses, expectedRevenue, confirmedRevenue, events: [...events.values()], recent };
}

function normalizePassTemplate(pass) {
  const imageDataUrl = String(pass.imageDataUrl || '').startsWith('data:image/') ? String(pass.imageDataUrl).slice(0, 900000) : '';
  const fields = Array.isArray(pass.fields) ? pass.fields.slice(0, 10).map((field) => ({ label: String(field.label || '').slice(0, 40), value: String(field.value || '').slice(0, 140) })).filter((field) => field.label) : [];
  return { title: String(pass.title || 'Noctivus 26 Event Pass').slice(0, 80), imageDataUrl, fields };
}

async function sendInvitation(registration, pass) {
  if (!process.env.RESEND_API_KEY || !process.env.CONFIRM_FROM) return;
  const participant = registration.participant || {};
  const eventNames = registration.eventRegistrations?.map((event) => event.eventName).join(', ') || 'Noctivus 26';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONFIRM_FROM,
      to: participant.email,
      subject: `${pass.title} - ${registration.registrationId}`,
      html: invitationHtml(registration, pass, eventNames),
    }),
  });
}

function invitationHtml(registration, pass, eventNames) {
  const participant = registration.participant || {};
  const fields = [
    ['Name', participant.name],
    ['College', participant.college],
    ['Event', eventNames],
    ['Registration ID', registration.registrationId],
    ...pass.fields.map((field) => [field.label, field.value]),
  ];
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111"><h1>${escapeHtml(pass.title)}</h1>${pass.imageDataUrl ? `<img src="${pass.imageDataUrl}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:10px">` : ''}<p>Your Noctivus '26 event pass is ready.</p><table style="width:100%;border-collapse:collapse">${fields.map(([label, value]) => `<tr><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}</table></div>`;
}

function registrationsToCsv(registrations) {
  const header = ['Registration ID', 'Name', 'Email', 'Phone', 'College', 'Food', 'Events', 'Status', 'UTR', 'Expected Amount', 'Claimed Amount', 'Submitted At', 'Verified At'];
  const rows = registrations.map((registration) => [
    registration.registrationId,
    registration.participant?.name,
    registration.participant?.email,
    registration.participant?.phone,
    registration.participant?.college,
    registration.participant?.foodPreference,
    registration.eventRegistrations?.map((event) => event.eventName).join('; '),
    registration.paymentStatus,
    registration.utrNumber,
    registration.expectedAmount,
    registration.claimedAmount,
    registration.paymentSubmittedAt,
    registration.verifiedAt,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value = '') {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function createAiAnalysis(overview) {
  return createLocalAnalysis(overview);
}

function createLocalAnalysis(overview) {
  const pendingRate = overview.total ? Math.round((overview.statuses.pending / overview.total) * 100) : 0;
  const confirmationRate = overview.total ? Math.round((overview.statuses.confirmed / overview.total) * 100) : 0;
  const mismatchRate = overview.total ? Math.round(((overview.statuses.mismatch + overview.statuses.duplicate) / overview.total) * 100) : 0;
  const sortedEvents = [...overview.events].sort((a, b) => b.registrations - a.registrations);
  const topEvent = sortedEvents[0];
  const slowEvents = sortedEvents.filter((event) => event.registrations === 0).map((event) => event.eventName);
  const pendingEvents = [...overview.events].filter((event) => event.pending > 0).sort((a, b) => b.pending - a.pending);
  const revenueEvents = [...overview.events].filter((event) => event.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  const lines = [
    'Offline analysis',
    `Total registrations: ${overview.total}`,
    `Payment status: ${overview.statuses.confirmed} confirmed, ${overview.statuses.pending} pending, ${overview.statuses.mismatch} mismatch, ${overview.statuses.duplicate} duplicate.`,
    `Confirmation rate: ${confirmationRate}%. Pending rate: ${pendingRate}%. Exception rate: ${mismatchRate}%.`,
    `Revenue: Rs.${overview.confirmedRevenue} confirmed from Rs.${overview.expectedRevenue} expected.`,
  ];

  if (topEvent) lines.push(`Highest registration event: ${topEvent.eventName} with ${topEvent.registrations} members.`);
  if (revenueEvents[0]) lines.push(`Highest confirmed revenue event: ${revenueEvents[0].eventName} with Rs.${revenueEvents[0].revenue}.`);
  if (pendingEvents[0]) lines.push(`Payment verification priority: ${pendingEvents[0].eventName} has ${pendingEvents[0].pending} pending payment(s).`);
  if (slowEvents.length) lines.push(`Events needing promotion: ${slowEvents.join(', ')}.`);

  lines.push('Event-wise breakdown:');
  overview.events.forEach((event) => {
    lines.push(`- ${event.eventName}: ${event.registrations} total, ${event.confirmed} confirmed, ${event.pending} pending, Rs.${event.revenue} confirmed revenue.`);
  });

  const recommendations = [];
  if (overview.statuses.pending > 0) recommendations.push('Verify pending UTRs before sending invitation passes.');
  if (mismatchRate > 10) recommendations.push('Check mismatch and duplicate cases manually before exporting final participant lists.');
  if (slowEvents.length) recommendations.push('Push event-specific announcements for events with zero registrations.');
  if (!recommendations.length) recommendations.push('Registration flow looks stable. Continue monitoring event-wise demand and payment confirmations.');

  lines.push('Recommended actions:');
  recommendations.forEach((item) => lines.push(`- ${item}`));
  return lines.join('\n');
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
