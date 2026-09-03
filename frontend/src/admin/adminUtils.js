import { getApiBase, apiUrl } from '../lib/api';

export const apiBase = getApiBase();

export const apiPath = (path) => apiUrl(path);

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const tabs = [
  'Dashboard',
  'Verify Members',
  'Check-in',
  'Food Scanner',
  'Attendance',
  'Events',
  'Event Scheduler',
  'Invitations',
  'AI Analysis',
  'Export',
  'Audit Log',
  'Admin Access',
];

export const statuses = ['pending', 'confirmed', 'mismatch', 'duplicate'];

// ─── Global CSRF token store ─────────────────────────────────────────────────
// Stored at module level so every adminFetch call can attach it automatically,
// regardless of whether the calling component has received authHeaders yet.
let _csrfToken = '';

export function setGlobalCsrf(token) {
  if (token) _csrfToken = token;
}

export function getGlobalCsrf() {
  return _csrfToken;
}

// adminFetch always attaches credentials + CSRF on non-safe methods.
// Callers may still pass authHeaders for explicit override; the global token
// is merged in as a baseline so nothing is ever left without CSRF protection.
export const adminFetch = (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  const baseHeaders = { ...(options.headers || {}) };

  // Attach global CSRF on state-changing requests if not already set by caller
  if (!safeMethods.has(method) && _csrfToken && !baseHeaders['X-CSRF-Token']) {
    baseHeaders['X-CSRF-Token'] = _csrfToken;
  }

  return fetch(url, { credentials: 'include', ...options, headers: baseHeaders });
};

export async function bulkVerify(authHeaders, registrationIds, status) {
  await adminFetch(apiPath('/api/admin/registrations/bulk-verify'), {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationIds, status }),
  });
}
