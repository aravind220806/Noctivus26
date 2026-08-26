import { eventCatalog } from '../events.js';
import { serializeRegistration } from './registrationService.js';

export function buildOverview(registrations) {
  const statuses = { pending: 0, confirmed: 0, mismatch: 0, duplicate: 0 };
  const events = new Map(eventCatalog.map((event) => [event.id, { eventId: event.id, eventName: event.name, category: event.category, registrations: 0, confirmed: 0, pending: 0, revenue: 0 }]));
  let expectedRevenue = 0;
  let confirmedRevenue = 0;
  registrations.forEach((registration) => {
    statuses[registration.paymentStatus] = (statuses[registration.paymentStatus] || 0) + 1;
    expectedRevenue += Number(registration.expectedAmount || 0);
    if (registration.paymentStatus === 'confirmed') confirmedRevenue += Number(registration.expectedAmount || 0);
    registration.eventRegistrations?.forEach((entry) => {
      const row = events.get(entry.eventId) || { eventId: entry.eventId, eventName: entry.eventName || entry.eventId, category: entry.category || '', registrations: 0, confirmed: 0, pending: 0, revenue: 0 };
      row.registrations += 1;
      if (registration.paymentStatus === 'confirmed') {
        row.confirmed += 1;
        row.revenue += Number(entry.feeSnapshot || registration.expectedAmount || 0);
      }
      if (registration.paymentStatus === 'pending') row.pending += 1;
      events.set(entry.eventId, row);
    });
  });
  const recent = registrations.slice(0, 8).map(serializeRegistration);
  return { total: registrations.length, statuses, expectedRevenue, confirmedRevenue, events: [...events.values()], recent };
}

export async function createAiAnalysis(overview) {
  return createLocalAnalysis(overview);
}

function createLocalAnalysis(overview) {
  const pendingRate = overview.total ? Math.round((overview.statuses.pending / overview.total) * 100) : 0;
  const confirmationRate = overview.total ? Math.round((overview.statuses.confirmed / overview.total) * 100) : 0;
  const mismatchRate = overview.total ? Math.round(((overview.statuses.mismatch + overview.statuses.duplicate) / overview.total) * 100) : 0;
  const sortedEvents = [...overview.events].sort((a, b) => b.registrations - a.registrations);
  const topEvent = sortedEvents[0];
  const slowEvents = sortedEvents.filter((event) => event.registrations === 0).map((event) => event.eventName);
  const pendingEvents = [...overview.events].filter((event) => event.pending > 0).sort((a, b) => b.pending - a.pending);
  const revenueEvents = [...overview.events].filter((event) => event.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  const lines = [
    'Offline analysis',
    `Total registrations: ${overview.total}`,
    `Payment status: ${overview.statuses.confirmed} confirmed, ${overview.statuses.pending} pending, ${overview.statuses.mismatch} mismatch, ${overview.statuses.duplicate} duplicate.`,
    `Confirmation rate: ${confirmationRate}%. Pending rate: ${pendingRate}%. Exception rate: ${mismatchRate}%.`,
    `Revenue: Rs.${overview.confirmedRevenue} confirmed from Rs.${overview.expectedRevenue} expected.`,
  ];

  if (topEvent) lines.push(`Highest registration event: ${topEvent.eventName} with ${topEvent.registrations} members.`);
  if (revenueEvents[0]) lines.push(`Highest confirmed revenue event: ${revenueEvents[0].eventName} with Rs.${revenueEvents[0].revenue}.`);
  if (pendingEvents[0]) lines.push(`Payment verification priority: ${pendingEvents[0].eventName} has ${pendingEvents[0].pending} pending payment(s).`);
  if (slowEvents.length) lines.push(`Events needing promotion: ${slowEvents.join(', ')}.`);

  lines.push('Event-wise breakdown:');
  overview.events.forEach((event) => {
    lines.push(`- ${event.eventName}: ${event.registrations} total, ${event.confirmed} confirmed, ${event.pending} pending, Rs.${event.revenue} confirmed revenue.`);
  });

  const recommendations = [];
  if (overview.statuses.pending > 0) recommendations.push('Verify pending UTRs before sending invitation passes.');
  if (mismatchRate > 10) recommendations.push('Check mismatch and duplicate cases manually before exporting final participant lists.');
  if (slowEvents.length) recommendations.push('Push event-specific announcements for events with zero registrations.');
  if (!recommendations.length) recommendations.push('Registration flow looks stable. Continue monitoring event-wise demand and payment confirmations.');

  lines.push('Recommended actions:');
  recommendations.forEach((item) => lines.push(`- ${item}`));
  return lines.join('\n');
}
