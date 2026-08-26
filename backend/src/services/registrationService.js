import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { eventCatalog } from '../events.js';
import { Registration } from '../model.js';
import { normalizeDigits, validateRegistration } from '../validation.js';
import { memoryRegistrations } from '../db/memoryStore.js';
import { registrationAdminProjection } from '../db/projections.js';

const createRegistrationId = () => `NOC26-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export function registrationStatus() {
  const registrationOpen = process.env.REGISTRATION_OPEN === 'true' && eventCatalog.every((event) => event.detailsComplete);
  return {
    registrationOpen,
    events: eventCatalog.map((event) => ({
      ...event,
      status: registrationOpen ? 'open' : 'opening-soon',
    })),
  };
}

export async function checkUtrAvailability(input) {
  const utrNumber = normalizeDigits(input);
  if (!/^\d{12}$/.test(utrNumber)) return { statusCode: 400, body: { available: false, message: 'Enter exactly 12 digits.' } };

  let duplicate;
  if (mongoose.connection.readyState === 1) duplicate = Boolean(await Registration.exists({ normalizedUtr: utrNumber }));
  else {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MEMORY_DB !== 'true') return { statusCode: 503, body: { available: false, message: 'UTR verification is temporarily unavailable.' } };
    duplicate = memoryRegistrations.some((item) => item.normalizedUtr === utrNumber);
  }

  return { statusCode: 200, body: { available: !duplicate, message: duplicate ? 'This UTR has already been submitted.' : 'UTR is available.' } };
}

export async function createRegistration(payload) {
  if (process.env.REGISTRATION_OPEN !== 'true' || eventCatalog.some((event) => !event.detailsComplete)) {
    return { statusCode: 403, body: { message: 'Registration is not open yet.' } };
  }

  const result = validateRegistration(payload);
  if (!result.valid) return { statusCode: 400, body: { message: result.errors[0], errors: result.errors } };

  const eventIds = result.value.eventRegistrations.map((event) => event.eventId);
  const record = { registrationId: createRegistrationId(), ...result.value, paymentStatus: 'pending', paymentSubmittedAt: new Date() };

  if (mongoose.connection.readyState === 1) {
    const duplicate = await Registration.exists({ 'normalized.email': result.value.normalized.email, 'eventRegistrations.eventId': { $in: eventIds } });
    if (duplicate) return { statusCode: 409, body: { message: 'This email is already registered for one of the selected events.' } };
    await Registration.create(record);
  } else {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MEMORY_DB !== 'true') return { statusCode: 503, body: { message: 'Registration service is not connected to its database.' } };
    const duplicateEvent = memoryRegistrations.some((item) => item.normalized.email === result.value.normalized.email && item.eventRegistrations.some((event) => eventIds.includes(event.eventId)));
    if (duplicateEvent) return { statusCode: 409, body: { message: 'This email is already registered for one of the selected events.' } };
    if (memoryRegistrations.some((item) => item.normalizedUtr === result.value.normalizedUtr)) return { statusCode: 409, body: { message: 'This UTR has already been submitted.' } };
    memoryRegistrations.push(record);
  }

  return {
    statusCode: 201,
    body: {
      registrationId: record.registrationId,
      status: 'pending',
      expectedAmount: record.expectedAmount,
      message: 'Registration received and awaiting payment verification.',
    },
  };
}

export async function loadRegistrations(filters = {}) {
  let registrations;
  if (mongoose.connection.readyState === 1) registrations = await Registration.find(registrationQuery(filters), registrationAdminProjection).sort({ createdAt: -1 }).lean();
  else registrations = [...memoryRegistrations].sort((a, b) => new Date(b.createdAt || b.paymentSubmittedAt || 0) - new Date(a.createdAt || a.paymentSubmittedAt || 0));
  if (mongoose.connection.readyState !== 1 && filters.eventId) registrations = registrations.filter((registration) => registration.eventRegistrations?.some((event) => event.eventId === filters.eventId));
  if (mongoose.connection.readyState !== 1 && filters.status) registrations = registrations.filter((registration) => registration.paymentStatus === filters.status);
  return registrations;
}

export async function updateRegistration(registrationId, update) {
  if (mongoose.connection.readyState === 1) return Registration.findOneAndUpdate({ registrationId }, update, { new: true, lean: true, projection: registrationAdminProjection });
  const registration = memoryRegistrations.find((item) => item.registrationId === registrationId);
  if (!registration) return null;
  Object.assign(registration, update);
  return registration;
}

export function serializeRegistration(registration) {
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

function registrationQuery(filters = {}) {
  const query = {};
  if (filters.eventId) query['eventRegistrations.eventId'] = filters.eventId;
  if (filters.status) query.paymentStatus = filters.status;
  return query;
}
