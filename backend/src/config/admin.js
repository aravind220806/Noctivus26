export const adminTabs = ['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export', 'Admin Access'];

export const sessionTtlMs = 8 * 60 * 60 * 1000;

export function ownerEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function isOwnerAdmin(email) {
  return ownerEmails().includes(String(email).toLowerCase());
}

export function normalizeAdminTabs(tabs) {
  const allowed = new Set(adminTabs);
  return [...new Set((Array.isArray(tabs) ? tabs : []).map(String).filter((tab) => allowed.has(tab)))];
}
