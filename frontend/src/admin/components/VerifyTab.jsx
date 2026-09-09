import { useEffect, useMemo, useState } from 'react';
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
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [trashBusy, setTrashBusy] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [emptyTrashText, setEmptyTrashText] = useState('');

  const loadTrash = async () => {
    const response = await adminFetch(apiPath('/api/admin/registrations?trashed=true'), {
      headers: authHeaders,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.detail || 'Unable to load trash.');
    setTrashItems(data.registrations || []);
    setTrashCount(data.trashCount ?? (data.registrations || []).length);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await adminFetch(apiPath('/api/admin/registrations?trashed=true'), {
          headers: authHeaders,
        });
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) {
          setTrashCount(data.trashCount ?? (data.registrations || []).length);
          if (showTrash) setTrashItems(data.registrations || []);
        }
      } catch {
        /* ignore count prefetch errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, showTrash, registrations]);

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
    const source = showTrash ? trashItems : registrations;
    const term = search.toLowerCase().trim();
    return source.filter((item) => {
      if (!term) return true;
      return `${item.registrationId} ${item.participant?.name} ${item.participant?.email} ${item.participant?.phone} ${item.utrNumber}`
        .toLowerCase()
        .includes(term);
    });
  }, [registrations, trashItems, showTrash, search]);

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

  const moveSelectedToTrash = async () => {
    if (!selected.length) return;
    setTrashBusy(true);
    setFeedback((prev) => ({ ...prev, cleanup: '' }));
    try {
      const response = await adminFetch(apiPath('/api/admin/registrations/trash'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.detail || 'Unable to move members to trash.');
      setSelected([]);
      setFeedback((prev) => ({
        ...prev,
        cleanup: `Moved ${data.trashed || selected.length} member(s) to trash.`,
      }));
      if (onChanged) onChanged();
      await loadTrash();
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        cleanup: error instanceof Error ? error.message : 'Unable to move members to trash.',
      }));
    } finally {
      setTrashBusy(false);
    }
  };

  const restoreSelected = async () => {
    if (!selected.length) return;
    setTrashBusy(true);
    setFeedback((prev) => ({ ...prev, cleanup: '' }));
    try {
      const response = await adminFetch(apiPath('/api/admin/registrations/trash/restore'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.detail || 'Unable to restore members.');
      setSelected([]);
      setFeedback((prev) => ({
        ...prev,
        cleanup: `Restored ${data.restored || 0} member(s) from trash.`,
      }));
      await loadTrash();
      if (onChanged) onChanged();
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        cleanup: error instanceof Error ? error.message : 'Unable to restore members.',
      }));
    } finally {
      setTrashBusy(false);
    }
  };

  const emptyTrash = async () => {
    setTrashBusy(true);
    setFeedback((prev) => ({ ...prev, cleanup: '' }));
    try {
      const response = await adminFetch(apiPath('/api/admin/registrations/trash/empty'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: emptyTrashText }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.detail || 'Unable to empty trash.');
      setEmptyTrashOpen(false);
      setEmptyTrashText('');
      setSelected([]);
      setTrashItems([]);
      setTrashCount(0);
      setFeedback((prev) => ({
        ...prev,
        cleanup: `Permanently deleted ${data.deleted || 0} trashed member(s).`,
      }));
      if (onChanged) onChanged();
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        cleanup: error instanceof Error ? error.message : 'Unable to empty trash.',
      }));
    } finally {
      setTrashBusy(false);
    }
  };

  const openTrash = async () => {
    setShowTrash(true);
    setSelected([]);
    setStatus('');
    setTrashBusy(true);
    try {
      await loadTrash();
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        cleanup: error instanceof Error ? error.message : 'Unable to load trash.',
      }));
    } finally {
      setTrashBusy(false);
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
        ...(activeRegistration.trashedAt
          ? [
              ['Trashed At', activeRegistration.trashedAt],
              ['Trashed By', activeRegistration.trashedBy],
            ]
          : []),
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
          <select value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={showTrash}>
            <option value="">All events</option>
            {overview?.events?.map((event) => (
              <option key={event.eventId} value={event.eventId}>{event.eventName}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="verify-status-tabs" aria-label="Members or trash">
        <button
          type="button"
          className={`verify-status-tab ${!showTrash ? 'is-active' : ''}`}
          onClick={() => {
            setShowTrash(false);
            setSelected([]);
          }}
        >
          <span>Active members</span>
        </button>
        <button
          type="button"
          className={`verify-status-tab ${showTrash ? 'is-active' : ''}`}
          onClick={openTrash}
        >
          <span>Trash</span>
          <strong>{trashCount}</strong>
        </button>
      </div>

      {!showTrash && (
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
      )}

      <div className="verify-bulk-actions">
        {!showTrash && (
          <>
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
            <button
              type="button"
              className="button button-danger"
              disabled={!selected.length || trashBusy}
              onClick={moveSelectedToTrash}
            >
              {trashBusy ? 'Moving...' : `Move selected to trash${selected.length ? ` (${selected.length})` : ''}`}
            </button>
          </>
        )}
        {showTrash && (
          <>
            <button
              type="button"
              className="button button-secondary"
              disabled={!selected.length || trashBusy}
              onClick={restoreSelected}
            >
              {trashBusy ? 'Working...' : `Restore selected${selected.length ? ` (${selected.length})` : ''}`}
            </button>
            <button
              type="button"
              className="button button-danger"
              disabled={!trashCount || trashBusy}
              onClick={() => setEmptyTrashOpen(true)}
            >
              Empty trash
            </button>
          </>
        )}
      </div>
      {feedback.cleanup && <p className="admin-message">{feedback.cleanup}</p>}
      <RegistrationTable
        registrations={showTrash ? visibleRegistrations : (status ? visibleRegistrations : groupedRegistrations.pending)}
        selected={selected}
        setSelected={setSelected}
        onOpenDetails={setActiveRegistration}
        renderActions={(registration) => {
          if (showTrash) {
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
      {emptyTrashOpen && (
        <div className="admin-modal-overlay" onClick={() => setEmptyTrashOpen(false)}>
          <div className="member-detail-modal cleanup-modal" role="dialog" aria-modal="true" aria-labelledby="empty-trash-title" onClick={(event) => event.stopPropagation()}>
            <header className="member-detail-modal__header">
              <div>
                <span>Admin action</span>
                <h2 id="empty-trash-title">Empty trash</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setEmptyTrashOpen(false)} aria-label="Close empty trash dialog">
                x
              </button>
            </header>
            <div className="cleanup-modal__body">
              <p>
                Permanently deletes {trashCount} trashed member registration(s). This cannot be undone.
                Active members are not affected.
              </p>
              <label className="field">
                <span>Type EMPTY TRASH</span>
                <input value={emptyTrashText} onChange={(event) => setEmptyTrashText(event.target.value)} placeholder="EMPTY TRASH" />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setEmptyTrashOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={trashBusy || emptyTrashText !== 'EMPTY TRASH'}
                  onClick={emptyTrash}
                >
                  {trashBusy ? 'Deleting...' : 'Empty trash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
