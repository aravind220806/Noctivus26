import { useEffect, useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';

export function EventsTab({ authHeaders, onEventChanged }) {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    const response = await adminFetch(apiPath('/api/admin/events'), { headers: authHeaders });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      const loadedEvents = data.events || [];
      setItems(loadedEvents);
      setDrafts(
        Object.fromEntries(
          loadedEvents.map((event) => [
            event.id,
            {
              date: event.date || '',
              time: event.time || '',
              gate: event.gate || '',
              venue: event.venue || '',
              terminal: event.terminal || 'MAIN HALL',
              seatType: event.seatType || 'VIP',
              passActive: event.passActive !== false,
            },
          ])
        )
      );
    } else {
      setMessage(data.detail || data.message || 'Unable to load events.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (event, changes) => {
    setSavingId(event.id);
    const response = await adminFetch(apiPath(`/api/admin/events/${event.id}`), {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    const data = await response.json().catch(() => ({}));
    setSavingId(null);
    if (!response.ok) return setMessage(data.detail || data.message || 'Unable to update event.');
    setMessage(`Updated ${event.name} successfully.`);
    await load();
    if (onEventChanged) onEventChanged();
  };

  const changeDraft = (id, key, value) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));

  const openCount = items.filter((item) => (item.effectiveStatus || item.status) === 'open').length;
  const closedCount = items.filter((item) => (item.effectiveStatus || item.status) !== 'open').length;

  const filteredItems = items.filter((event) => {
    const effStatus = event.effectiveStatus || event.status || 'open';
    if (statusFilter !== 'all' && effStatus !== statusFilter) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      event.name?.toLowerCase().includes(query) ||
      event.category?.toLowerCase().includes(query) ||
      event.venue?.toLowerCase().includes(query) ||
      drafts[event.id]?.venue?.toLowerCase().includes(query) ||
      event.id?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="events-tab-wrapper">
      {/* Top Banner Toolbar */}
      <div className="events-management-header">
        <div className="events-title-area">
          <h2 className="events-section-title">Event Management &amp; Status Controls</h2>
          <p className="admin-help">
            Toggle registration status (Open / Closed), assign event venues, and configure boarding pass details.
          </p>
        </div>
        <div className="events-stats-summary">
          <span className="events-stat-badge">
            Total: <strong>{items.length}</strong>
          </span>
          <span className="events-stat-badge events-stat-badge--open">
            Open: <strong>{openCount}</strong>
          </span>
          <span className="events-stat-badge events-stat-badge--closed">
            Closed: <strong>{closedCount}</strong>
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="events-filter-bar">
        <div className="events-search-field">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event name, category, or venue..."
            className="events-search-input"
          />
          {search && (
            <button type="button" className="search-clear-btn" onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>
        <div className="events-status-select-wrap">
          <span className="filter-label">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="events-status-select"
          >
            <option value="all">All Events ({items.length})</option>
            <option value="open">Open Only ({openCount})</option>
            <option value="closed">Closed Only ({closedCount})</option>
          </select>
        </div>
      </div>

      {message && <div className="admin-message-banner">{message}</div>}

      {/* Event Cards Grid */}
      <div className="events-cards-container">
        {filteredItems.length === 0 ? (
          <div className="events-empty-state">
            <p>No events match the selected search or filter criteria.</p>
          </div>
        ) : (
          filteredItems.map((event) => {
            const effStatus = event.effectiveStatus || event.status || 'open';
            const isOpen = effStatus === 'open';
            const isSaving = savingId === event.id;

            return (
              <article className="event-card-box" key={event.id}>
                {/* Event Card Header */}
                <div className="event-card-top-row">
                  <div className="event-card-left-info">
                    <div className="event-name-row">
                      <h3 className="event-heading">{event.name}</h3>
                      {event.category && (
                        <span className={`category-pill category-pill--${event.category.toLowerCase().replace(/[^a-z]/g, '')}`}>
                          {event.category}
                        </span>
                      )}
                    </div>
                    <div className="event-tags-row">
                      <span className="event-venue-tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {drafts[event.id]?.venue || event.venue || 'No venue assigned'}
                      </span>
                      <span className="event-meta-pill">₹{event.fee} fee</span>
                      <span className="event-meta-pill">{event.registrationCount || 0} registered</span>
                    </div>
                  </div>

                  <div className="event-card-right-actions">
                    <span className={`status-pill status-pill--${effStatus}`}>
                      <span className="status-dot" />
                      {effStatus.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className={`button button-sm ${isOpen ? 'button-close' : 'button-open'}`}
                      disabled={isSaving}
                      onClick={() => save(event, { status: isOpen ? 'closed' : 'open' })}
                    >
                      {isSaving ? 'Updating...' : isOpen ? 'Close Event' : 'Open Event'}
                    </button>
                  </div>
                </div>

                {/* Event Form Fields */}
                <div className="event-card-body">
                  <div className="event-inputs-grid">
                    <label className="event-field event-field--venue">
                      <span className="field-label">Venue Location</span>
                      <input
                        className="event-text-input"
                        value={drafts[event.id]?.venue || ''}
                        onChange={(e) => changeDraft(event.id, 'venue', e.target.value)}
                        placeholder="e.g. CSE Cyber Lab 1 / Main Auditorium"
                      />
                    </label>
                    <label className="event-field">
                      <span className="field-label">Date</span>
                      <input
                        className="event-text-input"
                        value={drafts[event.id]?.date || ''}
                        onChange={(e) => changeDraft(event.id, 'date', e.target.value)}
                        placeholder="26 Sep 2026"
                      />
                    </label>
                    <label className="event-field">
                      <span className="field-label">Time</span>
                      <input
                        className="event-text-input"
                        value={drafts[event.id]?.time || ''}
                        onChange={(e) => changeDraft(event.id, 'time', e.target.value)}
                        placeholder="09:00 AM"
                      />
                    </label>
                    <label className="event-field">
                      <span className="field-label">Gate</span>
                      <input
                        className="event-text-input"
                        value={drafts[event.id]?.gate || ''}
                        onChange={(e) => changeDraft(event.id, 'gate', e.target.value)}
                        placeholder="VEC Gate 1"
                      />
                    </label>
                    <label className="event-field">
                      <span className="field-label">Terminal / Hall</span>
                      <input
                        className="event-text-input"
                        value={drafts[event.id]?.terminal || ''}
                        onChange={(e) => changeDraft(event.id, 'terminal', e.target.value)}
                        placeholder="MAIN HALL"
                      />
                    </label>
                    <label className="event-field">
                      <span className="field-label">Seat Type</span>
                      <input
                        className="event-text-input"
                        value={drafts[event.id]?.seatType || ''}
                        onChange={(e) => changeDraft(event.id, 'seatType', e.target.value)}
                        placeholder="VIP"
                      />
                    </label>
                  </div>

                  {/* Actions Footer */}
                  <div className="event-card-footer">
                    <label className="event-checkbox-label">
                      <input
                        type="checkbox"
                        checked={drafts[event.id]?.passActive !== false}
                        onChange={(e) => changeDraft(event.id, 'passActive', e.target.checked)}
                        className="event-checkbox"
                      />
                      <span>Pass active on dispatch</span>
                    </label>

                    <button
                      type="button"
                      className="button button-save-event"
                      disabled={isSaving}
                      onClick={() => save(event, drafts[event.id])}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      {isSaving ? 'Saving...' : 'Save details'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
