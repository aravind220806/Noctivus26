import { useMemo, useState } from 'react';
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
  isOwner = false,
}) {
  const feedbackMessages = {
    confirmed: '✅ Payment confirmed. Email & Google Sheets sync in progress.',
    mismatch: '⚠️ Payment mismatch email queued. Ask the participant to contact the registration team.',
    duplicate: '⚠️ Duplicate payment reference email queued. Ask the participant to contact the registration team.',
  };

  const [notes, setNotes] = useState({});
  const [search, setSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [activeRegistration, setActiveRegistration] = useState(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupText, setCleanupText] = useState('');
  const [cleanupBusy, setCleanupBusy] = useState(false);

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
          [registrationId]: feedbackMessages[nextStatus] || 'Status updated. Email sync in progress.',
        }));
        if (onChanged) onChanged();
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const visibleRegistrations = useMemo(() => {
    const term = search.toLowerCase().trim();
    return registrations.filter((item) => {
      if (!term) return true;
      return `${item.registrationId} ${item.participant?.name} ${item.participant?.email} ${item.participant?.phone} ${item.utrNumber}`
        .toLowerCase()
        .includes(term);
    });
  }, [registrations, search]);

  const groupedRegistrations = useMemo(() => {
    const groups = { pending: [], confirmed: [], mismatch: [], duplicate: [] };
    visibleRegistrations.forEach((item) => {
      const key = item.paymentStatus || 'pending';
      if (groups[key]) groups[key].push(item);
    });
    return groups;
  }, [visibleRegistrations]);

  const statusFilters = [
    { key: '', title: 'Pending Payment', count: groupedRegistrations.pending.length },
    { key: 'confirmed', title: 'Confirmed Payment', count: status === 'confirmed' ? visibleRegistrations.length : groupedRegistrations.confirmed.length },
    { key: 'mismatch', title: 'Mismatch', count: status === 'mismatch' ? visibleRegistrations.length : groupedRegistrations.mismatch.length },
    { key: 'duplicate', title: 'Duplicate', count: status === 'duplicate' ? visibleRegistrations.length : groupedRegistrations.duplicate.length },
  ];

  const changeStatusFilter = (nextStatus) => {
    setSelected([]);
    setStatus(nextStatus);
  };

  const clearTestMembers = async () => {
    setCleanupBusy(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/registrations/clear-test-data'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: cleanupText }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to clear member records.');
      setCleanupOpen(false);
      setCleanupText('');
      setSelected([]);
      setFeedback({});
      if (onChanged) onChanged();
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        cleanup: error instanceof Error ? error.message : 'Unable to clear member records.',
      }));
    } finally {
      setCleanupBusy(false);
    }
  };

  const detailRows = activeRegistration
    ? [
        ['Registration ID', activeRegistration.registrationId],
        ['Name', activeRegistration.participant?.name],
        ['College', activeRegistration.participant?.college],
        ['Email', activeRegistration.participant?.email],
        ['Phone', activeRegistration.participant?.phone],
        ['Food', activeRegistration.participant?.foodPreference],
        ['UTR', activeRegistration.utrNumber],
        ['Expected Amount', `₹${activeRegistration.expectedAmount || 0}`],
        ['Claimed Amount', `₹${activeRegistration.claimedAmount || 0}`],
        ['Status', activeRegistration.paymentStatus || 'pending'],
        ['Notes', activeRegistration.verificationNotes],
      ]
    : [];

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
      </div>
      <div className="verify-status-tabs" aria-label="Payment status filters">
        {statusFilters.map((item) => (
          <button
            key={item.title}
            type="button"
            className={`verify-status-tab ${status === item.key ? 'is-active' : ''}`}
            onClick={() => changeStatusFilter(item.key)}
          >
            <span>{item.title}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
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
        {isOwner && (
          <button
            type="button"
            className="button button-danger"
            onClick={() => setCleanupOpen(true)}
          >
            Clean test members
          </button>
        )}
      </div>
      {feedback.cleanup && <p className="admin-message">{feedback.cleanup}</p>}
      <RegistrationTable
        registrations={status ? visibleRegistrations : groupedRegistrations.pending}
        selected={selected}
        setSelected={setSelected}
        onOpenDetails={setActiveRegistration}
        renderActions={(registration) => {
          const statusText = feedback[registration.registrationId];
          const isPendingRow = (registration.paymentStatus || 'pending') === 'pending';

          if (!isPendingRow) {
            return (
              <div className="verify-compact-actions">
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => setActiveRegistration(registration)}
                >
                  View Details
                </button>
              </div>
            );
          }

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
      {activeRegistration && (
        <div className="admin-modal-overlay" onClick={() => setActiveRegistration(null)}>
          <div className="member-detail-modal" role="dialog" aria-modal="true" aria-labelledby="member-detail-title" onClick={(event) => event.stopPropagation()}>
            <header className="member-detail-modal__header">
              <div>
                <span>{activeRegistration.registrationId}</span>
                <h2 id="member-detail-title">{activeRegistration.participant?.name || 'Participant'}</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setActiveRegistration(null)} aria-label="Close details">
                x
              </button>
            </header>
            <div className="member-detail-modal__grid">
              {detailRows.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value || '—'}</strong>
                </div>
              ))}
            </div>
            <div className="member-detail-modal__events">
              <span>Events</span>
              {(activeRegistration.eventRegistrations || []).map((event) => (
                <article key={event.eventId}>
                  <strong>{event.eventName}</strong>
                  <small>{event.category} - Team size {event.teamSize}</small>
                  {event.teamMembers?.length > 0 && (
                    <small>
                      Members: {event.teamMembers.map((member) => `${member.name}${member.rollNo ? ` (${member.rollNo})` : ''}`).join(', ')}
                    </small>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
      {cleanupOpen && (
        <div className="admin-modal-overlay" onClick={() => setCleanupOpen(false)}>
          <div className="member-detail-modal cleanup-modal" role="dialog" aria-modal="true" aria-labelledby="cleanup-title" onClick={(event) => event.stopPropagation()}>
            <header className="member-detail-modal__header">
              <div>
                <span>Owner action</span>
                <h2 id="cleanup-title">Clean test member data</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setCleanupOpen(false)} aria-label="Close cleanup dialog">
                x
              </button>
            </header>
            <div className="cleanup-modal__body">
              <p>This removes only registrations, member payment records, UTR history, revenue totals, and slot member assignments. Events, admin access, scheduler slots, and app settings stay available.</p>
              <label className="field">
                <span>Type CLEAR MEMBERS</span>
                <input value={cleanupText} onChange={(event) => setCleanupText(event.target.value)} placeholder="CLEAR MEMBERS" />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setCleanupOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={cleanupBusy || cleanupText !== 'CLEAR MEMBERS'}
                  onClick={clearTestMembers}
                >
                  {cleanupBusy ? 'Cleaning...' : 'Clean registrations'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
