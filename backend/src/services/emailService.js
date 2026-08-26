export function normalizePassTemplate(pass) {
  const imageDataUrl = String(pass.imageDataUrl || '').startsWith('data:image/') ? String(pass.imageDataUrl).slice(0, 900000) : '';
  const fields = Array.isArray(pass.fields) ? pass.fields.slice(0, 10).map((field) => ({ label: String(field.label || '').slice(0, 40), value: String(field.value || '').slice(0, 140) })).filter((field) => field.label) : [];
  return { title: String(pass.title || 'Noctivus 26 Event Pass').slice(0, 80), imageDataUrl, fields };
}

export function queueEmail(task) {
  setImmediate(() => {
    task().catch((error) => console.error('Email delivery failed:', error.message));
  });
}

export async function sendInvitation(registration, pass) {
  if (!process.env.RESEND_API_KEY || !process.env.CONFIRM_FROM) return;
  const participant = registration.participant || {};
  const eventNames = registration.eventRegistrations?.map((event) => event.eventName).join(', ') || 'Noctivus 26';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONFIRM_FROM,
      to: participant.email,
      subject: `${pass.title} - ${registration.registrationId}`,
      html: invitationHtml(registration, pass, eventNames),
    }),
  });
}

export async function sendConfirmation(registration) {
  if (!process.env.RESEND_API_KEY || !process.env.CONFIRM_FROM) return;
  const participant = registration.participant;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONFIRM_FROM,
      to: participant.email,
      subject: `Noctivus '26 registration confirmed - ${registration.registrationId}`,
      html: `<h1>You're confirmed, ${escapeHtml(participant.name)}.</h1><p>Your Noctivus '26 registration <strong>${escapeHtml(registration.registrationId)}</strong> is confirmed.</p>`,
    }),
  });
}

function invitationHtml(registration, pass, eventNames) {
  const participant = registration.participant || {};
  const fields = [
    ['Name', participant.name],
    ['College', participant.college],
    ['Event', eventNames],
    ['Registration ID', registration.registrationId],
    ...pass.fields.map((field) => [field.label, field.value]),
  ];
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111"><h1>${escapeHtml(pass.title)}</h1>${pass.imageDataUrl ? `<img src="${pass.imageDataUrl}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:10px">` : ''}<p>Your Noctivus '26 event pass is ready.</p><table style="width:100%;border-collapse:collapse">${fields.map(([label, value]) => `<tr><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}</table></div>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
