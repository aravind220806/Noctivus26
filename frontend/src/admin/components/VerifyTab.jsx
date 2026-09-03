import { useState } from 'react';
import { adminFetch, apiPath, bulkVerify } from '../adminUtils';
import { RegistrationTable } from './AdminUIHelpers';

export function VerifyTab({
  registrations,
  overview,
  authHeaders,
  onChanged,
  eventId,
  setEventId,
  status,
  setStatus,
  selected,
  setSelected,
}) {
  const [notes, setNotes] = useState({});
  const [search, setSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);
  const [feedback, setFeedback] = useState({});

  const verify = async (registrationId, nextStatus) => {
    setVerifyingId(registrationId);
    try {
      const response = await adminFetch(apiPath(`/api/admin/registrations/${registrationId}/verify`), {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, notes: notes[registrationId] || '', sendEmail: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.registration) {
        setFeedback((prev) => ({
          ...prev,
          [registrationId]: '✅ Payment confirmed. Email & Google Sheets sync in progress.',
        }));
        if (onChanged) onChanged();
      }
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <>
      <div className="admin-filters">
        <label className="field">
          <span>Search</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, UTR" />
        </label>
        <label className="field">
          <span>Event</span>
          <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">All events</option>
            {overview?.events?.map((event) => (
              <option key={event.eventId} value={event.eventId}>{event.eventName}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {['pending', 'confirmed', 'mismatch', 'duplicate'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="verify-bulk-actions">
        <button
          className="button button-secondary"
          disabled={!selected.length}
          onClick={async () => {
            await bulkVerify(authHeaders, selected, 'confirmed');
            setSelected([]);
            onChanged();
          }}
        >
          Confirm selected
        </button>
        <button
          className="button button-secondary"
          disabled={!selected.length}
          onClick={async () => {
            await bulkVerify(authHeaders, selected, 'mismatch');
            setSelected([]);
            onChanged();
          }}
        >
          Reject selected
        </button>
      </div>
      <RegistrationTable
        registrations={registrations.filter((item) => {
          const term = search.toLowerCase();
          return (
            !term ||
            `${item.participant?.name} ${item.participant?.email} ${item.participant?.phone} ${item.utrNumber}`
              .toLowerCase()
              .includes(term)
          );
        })}
        selected={selected}
        setSelected={setSelected}
        renderActions={(registration) => {
          const statusText = feedback[registration.registrationId];

          return (
            <div className="verify-actions-column">
              <div className="verify-actions">
                <input
                  placeholder="Verification notes"
                  value={notes[registration.registrationId] || ''}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [registration.registrationId]: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className="button button-primary button-small"
                  disabled={verifyingId === registration.registrationId}
                  onClick={() => verify(registration.registrationId, 'confirmed')}
                >
                  {verifyingId === registration.registrationId ? 'Confirming...' : 'Confirm Payment'}
                </button>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => verify(registration.registrationId, 'mismatch')}
                >
                  Mismatch
                </button>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => verify(registration.registrationId, 'duplicate')}
                >
                  Duplicate
                </button>
              </div>

              {statusText && (
                <div className="payment-email-feedback">
                  <span
                    className={`payment-email-badge ${
                      statusText.includes('✅') ? 'payment-email-badge--sent' : 'payment-email-badge--failed'
                    }`}
                  >
                    {statusText}
                  </span>
                </div>
              )}
            </div>
          );
        }}
      />
    </>
  );
}
