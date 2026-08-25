import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDigits, normalizeEmail, normalizeText, validateRegistration } from '../src/validation.js';

const valid = {
  participant: { name: 'Nila Raman', email: 'nila@example.com', phone: '9876543210', college: 'Velammal Engineering College', foodPreference: 'veg' },
  events: [{ eventId: 'ideathon', teamSize: 1, teamMembers: [] }],
  paymentReference: 'NOC26-ABC123-XYZ789',
  utrNumber: '123456789012', claimedAmount: 200,
  consent: { privacyAccepted: true, rulesAccepted: true },
};

test('normalizes participant input', () => {
  assert.equal(normalizeEmail(' NILA@Example.COM '), 'nila@example.com');
  assert.equal(normalizeDigits('+91 98765 43210'), '919876543210');
  assert.equal(normalizeText('  Nila   Raman  '), 'Nila Raman');
});

test('accepts a technical event at the server-configured fee', () => {
  const result = validateRegistration(valid);
  assert.equal(result.valid, true);
  assert.equal(result.value.expectedAmount, 200);
  assert.equal(result.value.participant.foodPreference, 'veg');
});

test('rejects a client-controlled payment amount', () => {
  const result = validateRegistration({ ...valid, claimedAmount: 1 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /amount/i);
});

test('uses the non-technical event fee', () => {
  const result = validateRegistration({ ...valid, events: [{ eventId: 'mystery-hunt', teamSize: 1, teamMembers: [] }], claimedAmount: 150 });
  assert.equal(result.valid, true);
  assert.equal(result.value.expectedAmount, 150);
});

test('rejects unknown events', () => {
  const result = validateRegistration({ ...valid, events: [{ eventId: 'unknown', teamSize: 1, teamMembers: [] }] });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /unknown event/i);
});

test('requires a UTR containing exactly 12 digits', () => {
  const tooShort = validateRegistration({ ...valid, utrNumber: '12345678901' });
  const tooLong = validateRegistration({ ...valid, utrNumber: '1234567890123' });
  assert.equal(tooShort.valid, false);
  assert.equal(tooLong.valid, false);
  assert.match(tooShort.errors.join(' '), /12 digits/i);
  assert.match(tooLong.errors.join(' '), /12 digits/i);
});
