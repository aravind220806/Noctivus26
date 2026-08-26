export function registrationsToCsv(registrations) {
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
