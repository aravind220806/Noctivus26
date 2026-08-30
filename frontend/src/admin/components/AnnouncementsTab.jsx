import { useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';

export function AnnouncementsTab({ authHeaders }) {
  const [form, setForm] = useState({ subject: '', message: '', audience: 'confirmed', channel: 'email' });
  const [result, setResult] = useState('');

  const send = async (event) => {
    event.preventDefault();
    const response = await adminFetch(apiPath('/api/admin/announcements/send'), {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    setResult(response.ok ? `${data.queued} email(s) queued.` : data.detail || data.message || 'Unable to send announcement.');
  };

  return (
    <form className="admin-panel announcement-panel" onSubmit={send}>
      <h2>Announcements</h2>
      <label className="field">
        <span>Subject</span>
        <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          rows="8"
        />
      </label>
      <label className="field">
        <span>Audience</span>
        <select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
          <option value="confirmed">All confirmed</option>
          <option value="checked-in">Checked in</option>
        </select>
      </label>
      <p className="admin-message">SMS is unavailable until a provider is configured.</p>
      {result && <p className="admin-message">{result}</p>}
      <button className="button button-primary" disabled={!form.subject || !form.message}>
        Queue email broadcast
      </button>
    </form>
  );
}
