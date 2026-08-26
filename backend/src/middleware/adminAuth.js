import crypto from 'node:crypto';
import { sessionTtlMs, normalizeAdminTabs } from '../config/admin.js';
import { resolveAdminAccess } from '../services/adminAccessService.js';

export function signAdminToken(user) {
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

export async function requireAdmin(request, response, next) {
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

export function requireAdminTab(tab) {
  return (request, response, next) => requireAdmin(request, response, () => {
    if (!request.admin.tabs?.includes(tab)) return response.status(403).json({ message: `${tab} access required.` });
    return next();
  });
}

export function requireAnyAdminTab(tabs) {
  return (request, response, next) => requireAdmin(request, response, () => {
    if (!tabs.some((tab) => request.admin.tabs?.includes(tab))) return response.status(403).json({ message: 'This admin action is not allowed for your account.' });
    return next();
  });
}
