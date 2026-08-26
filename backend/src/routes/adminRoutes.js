import express from 'express';
import rateLimit from 'express-rate-limit';
import { adminTabs, isOwnerAdmin, normalizeAdminTabs } from '../config/admin.js';
import { requireAdmin, requireAdminTab, requireAnyAdminTab, signAdminToken } from '../middleware/adminAuth.js';
import { buildOverview, createAiAnalysis } from '../services/analysisService.js';
import { deactivateAdminAccess, listAdminAccess, resolveAdminAccess, upsertAdminAccess } from '../services/adminAccessService.js';
import { normalizePassTemplate, queueEmail, sendConfirmation, sendInvitation } from '../services/emailService.js';
import { registrationsToCsv } from '../services/exportService.js';
import { verifyGoogleCredential } from '../services/googleAuthService.js';
import { loadRegistrations, serializeRegistration, updateRegistration } from '../services/registrationService.js';

export const adminRouter = express.Router();

const googleAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

adminRouter.post('/auth/google', googleAuthLimiter, async (request, response, next) => {
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
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/me', requireAdmin, async (request, response) => {
  response.json({ user: request.admin, tabs: request.admin.tabs });
});

adminRouter.get('/access', requireAdminTab('Admin Access'), async (_request, response, next) => {
  try {
    response.json({ users: await listAdminAccess(), tabs: adminTabs.filter((tab) => tab !== 'Admin Access') });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/access/:email', requireAdminTab('Admin Access'), async (request, response, next) => {
  try {
    const email = String(request.params.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return response.status(400).json({ message: 'Enter a valid email address.' });
    if (isOwnerAdmin(email)) return response.status(400).json({ message: 'Owner access is controlled from ADMIN_EMAILS.' });
    const tabs = normalizeAdminTabs(request.body.tabs);
    if (!tabs.length) return response.status(400).json({ message: 'Select at least one tab.' });
    const user = await upsertAdminAccess({ email, name: request.body.name, tabs, active: request.body.active !== false, actor: request.admin.email });
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/access/:email', requireAdminTab('Admin Access'), async (request, response, next) => {
  try {
    const email = String(request.params.email || '').trim().toLowerCase();
    if (isOwnerAdmin(email)) return response.status(400).json({ message: 'Owner access is controlled from ADMIN_EMAILS.' });
    await deactivateAdminAccess(email, request.admin.email);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/overview', requireAnyAdminTab(['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export']), async (_request, response, next) => {
  try {
    const registrations = await loadRegistrations();
    response.json(buildOverview(registrations));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/registrations', requireAnyAdminTab(['Verify Members', 'Invitations', 'Export']), async (request, response, next) => {
  try {
    const registrations = await loadRegistrations({ eventId: request.query.eventId, status: request.query.status });
    response.json({ registrations: registrations.map(serializeRegistration) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/registrations/:id/verify', requireAdminTab('Verify Members'), async (request, response, next) => {
  try {
    const allowed = ['confirmed', 'mismatch', 'duplicate'];
    if (!allowed.includes(request.body.status)) return response.status(400).json({ message: 'Invalid registration status.' });
    const update = { paymentStatus: request.body.status, verifiedAt: new Date(), verifiedBy: request.admin.email, verificationNotes: String(request.body.notes || '').slice(0, 500) };
    const registration = await updateRegistration(request.params.id, update);
    if (!registration) return response.status(404).json({ message: 'Registration not found.' });
    if (update.paymentStatus === 'confirmed' && request.body.sendEmail !== false) queueEmail(() => sendConfirmation(registration));
    response.json({ registration: serializeRegistration(registration) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/invitations/send', requireAdminTab('Invitations'), async (request, response, next) => {
  try {
    const registrationIds = Array.isArray(request.body.registrationIds) ? request.body.registrationIds.map(String).slice(0, 200) : [];
    if (!registrationIds.length) return response.status(400).json({ message: 'Select at least one member.' });
    const pass = normalizePassTemplate(request.body.pass || {});
    const all = await loadRegistrations();
    const selected = all.filter((registration) => registrationIds.includes(registration.registrationId));
    if (!selected.length) return response.status(404).json({ message: 'No matching registrations found.' });

    await Promise.all(selected.map(async (registration) => {
      await sendInvitation(registration, pass);
      await updateRegistration(registration.registrationId, {
        invitation: { sentAt: new Date(), sentBy: request.admin.email, passTitle: pass.title, passFields: pass.fields },
      });
    }));
    response.json({ sent: selected.length });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/export', requireAdminTab('Export'), async (request, response, next) => {
  try {
    const registrations = await loadRegistrations({ eventId: request.query.eventId, status: request.query.status });
    const csv = registrationsToCsv(registrations);
    response.type('text/csv').set('Content-Disposition', `attachment; filename="noctivus-${request.query.eventId || 'all'}-registrations.csv"`).send(csv);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/analysis/ai', requireAdminTab('AI Analysis'), async (_request, response, next) => {
  try {
    const registrations = await loadRegistrations();
    const overview = buildOverview(registrations);
    const analysis = await createAiAnalysis(overview);
    response.json({ analysis, generatedAt: new Date().toISOString(), mode: 'offline' });
  } catch (error) {
    next(error);
  }
});
