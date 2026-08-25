import { eventsById } from './events.js';

export function normalizeEmail(value = '') { return String(value).trim().toLowerCase(); }
export function normalizeDigits(value = '') { return String(value).replace(/\D/g, ''); }
export function normalizeText(value = '') { return String(value).trim().replace(/\s+/g, ' '); }

export function validateRegistration(input) {
  const errors = [];
  const participant = input?.participant || {};
  const email = normalizeEmail(participant.email);
  const phone = normalizeDigits(participant.phone);
  const utrNumber = normalizeDigits(input?.utrNumber);
  const paymentReference = normalizeText(input?.paymentReference).toUpperCase();
  const foodPreference = normalizeText(participant.foodPreference).toLowerCase();

  if (normalizeText(participant.name).length < 2) errors.push('Participant name is required.');
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('A valid email is required.');
  if (!/^\d{10}$/.test(phone)) errors.push('A valid 10-digit phone number is required.');
  if (normalizeText(participant.college).length < 2) errors.push('College is required.');
  if (!['veg', 'non-veg'].includes(foodPreference)) errors.push('Select a food preference.');
  if (!/^\d{12}$/.test(utrNumber)) errors.push('UTR/reference number must contain 12 digits.');
  if (!/^NOC26-[A-Z0-9-]{6,29}$/.test(paymentReference)) errors.push('Payment reference is invalid.');
  if (!input?.consent?.privacyAccepted) errors.push('Privacy consent is required.');

  const submittedEvents = Array.isArray(input?.events) ? input.events : [];
  if (!submittedEvents.length) errors.push('Select at least one event.');
  const ids = submittedEvents.map((item) => item.eventId);
  if (new Set(ids).size !== ids.length) errors.push('The same event cannot be selected twice.');

  const eventRegistrations = submittedEvents.flatMap((submitted) => {
    const configured = eventsById.get(submitted.eventId);
    if (!configured) {
      errors.push(`Unknown event: ${submitted.eventId || 'missing ID'}.`);
      return [];
    }
    if (!configured.detailsComplete) {
      errors.push(`${configured.name} registration details have not been announced yet.`);
      return [];
    }
    const teamSize = Number(submitted.teamSize);
    if (!Number.isInteger(teamSize) || teamSize < configured.teamMin || teamSize > configured.teamMax) {
      errors.push(`${configured.name} requires ${configured.teamMin === configured.teamMax ? configured.teamMax : `${configured.teamMin}–${configured.teamMax}`} participant(s).`);
    }
    const members = Array.isArray(submitted.teamMembers) ? submitted.teamMembers : [];
    if (members.length !== Math.max(0, teamSize - 1)) errors.push(`${configured.name} team details are incomplete.`);
    if (members.some((member) => normalizeText(member.name).length < 2)) errors.push(`Every ${configured.name} team member needs a name.`);
    return [{
      eventId: configured.id,
      eventName: configured.name,
      category: configured.category,
      feeSnapshot: configured.fee,
      teamSize,
      teamSizeMin: configured.teamMin,
      teamSizeMax: configured.teamMax,
      teamMembers: members.map((member) => ({ name: normalizeText(member.name), rollNo: normalizeText(member.rollNo).toUpperCase() })),
    }];
  });

  const expectedAmount = eventRegistrations.reduce((sum, event) => sum + event.feeSnapshot, 0);
  if (Number(input?.claimedAmount) !== expectedAmount) errors.push('Registration amount does not match the configured event fees.');

  return {
    valid: errors.length === 0,
    errors,
    value: {
      participant: {
        name: normalizeText(participant.name), email, phone,
        college: normalizeText(participant.college), foodPreference,
      },
      normalized: { email, phone, rollNo: '' },
      eventRegistrations,
      utrNumber,
      normalizedUtr: utrNumber,
      paymentReference,
      expectedAmount,
      claimedAmount: Number(input?.claimedAmount),
      consent: { privacyAccepted: true, rulesAccepted: true, acceptedAt: new Date() },
    },
  };
}
