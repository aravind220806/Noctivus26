import { getApiBase, apiUrl } from '../lib/api';

export const apiBase = getApiBase();

export const apiPath = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalizedPath}`;
};

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const tabs = [
  'Dashboard',
  'Verify Members',
  'Check-in',
  'Events',
  'Event Scheduler',
  'Invitations',
  'Announcements',
  'AI Analysis',
  'Export',
  'Audit Log',
  'Admin Access',
];

export const statuses = ['pending', 'confirmed', 'mismatch', 'duplicate'];

export const adminFetch = (url, options = {}) =>
  fetch(url, { credentials: 'include', ...options, headers: options.headers });

export async function bulkVerify(authHeaders, registrationIds, status) {
  await adminFetch(apiPath('/api/admin/registrations/bulk-verify'), {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationIds, status }),
  });
}
