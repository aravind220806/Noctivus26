import mongoose from 'mongoose';
import { adminTabs, isOwnerAdmin, normalizeAdminTabs, ownerEmails } from '../config/admin.js';
import { memoryAdminAccess } from '../db/memoryStore.js';
import { adminAccessProjection } from '../db/projections.js';
import { AdminAccess } from '../model.js';

export async function resolveAdminAccess(email) {
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

export async function listAdminAccess() {
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

export async function upsertAdminAccess({ email, name, tabs, active, actor }) {
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

export async function deactivateAdminAccess(email, actor) {
  if (mongoose.connection.readyState === 1) {
    await AdminAccess.findOneAndUpdate({ email }, { active: false, updatedBy: actor }, { upsert: false });
    return;
  }
  const existing = memoryAdminAccess.find((item) => item.email === email);
  if (existing) Object.assign(existing, { active: false, updatedBy: actor, updatedAt: new Date() });
}
