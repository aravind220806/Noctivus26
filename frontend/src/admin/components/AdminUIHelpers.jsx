import { statuses } from '../adminUtils';

export function Filters({ overview, eventId, setEventId, status, setStatus }) {
  return (
    <div className="admin-filters">
      <label className="field">
        <span>Event</span>
        <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
          <option value="">All events</option>
          {overview?.events.map((event) => (
            <option key={event.eventId} value={event.eventId}>
              {event.eventName}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function RegistrationTable({ registrations, selected, setSelected, renderActions }) {
  const toggle = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  if (registrations.length === 0) return <p className="admin-empty">No registrations match the current filters.</p>;

  return (
    <div className="registration-table">
      {registrations.map((registration) => (
        <article key={registration.registrationId} className="reg-card">
          <label className="reg-card__header">
            <input
              type="checkbox"
              checked={selected.includes(registration.registrationId)}
              onChange={() => toggle(registration.registrationId)}
            />
            <span className="reg-card__id">{registration.registrationId}</span>
          </label>
          <div className="reg-card__participant">
            <strong className="reg-card__name">{registration.participant?.name || '—'}</strong>
            <small className="reg-card__college">{registration.participant?.college || '—'}</small>
          </div>
          <div className="reg-card__events">
            <strong className="reg-card__event-names">
              {registration.eventRegistrations?.map((event) => event.eventName).join(', ') || 'No events'}
            </strong>
            <small className="reg-card__email">{registration.participant?.email || '—'}</small>
            {(registration.abstract || registration.igniteTopic || registration.participant?.abstract || registration.participant?.igniteTopic) && (
              <div className="reg-card__abstract">
                💡 <em>{registration.abstract || registration.igniteTopic || registration.participant?.abstract || registration.participant?.igniteTopic}</em>
              </div>
            )}
          </div>
          <div className="reg-card__status-wrap">
            <Status value={registration.paymentStatus} />
          </div>
          <div className="reg-card__payment-info">
            <strong className="reg-card__amount">₹{registration.expectedAmount}</strong>
            <small className="reg-card__utr">UTR {registration.utrNumber || '—'}</small>
          </div>
          <div className="reg-card__actions">
            {renderActions?.(registration)}
          </div>
        </article>
      ))}
    </div>
  );
}

export function RegistrationList({ registrations }) {
  return (
    <div className="recent-list">
      {registrations.map((registration) => (
        <div key={registration.registrationId}>
          <span>{registration.registrationId}</span>
          <strong>{registration.participant?.name}</strong>
          <small>{registration.eventRegistrations?.map((event) => event.eventName).join(', ')}</small>
          <Status value={registration.paymentStatus} />
        </div>
      ))}
    </div>
  );
}

export function EventBars({ events }) {
  const eventOrder = ['Ideathon', 'Cyber Heist CTF', 'IoT Exploit', 'Secure X VibeCode', 'Mind Cage', 'Mystery Hunt', 'Tune Trap', 'Auction Arena'];
  const sortedEvents = [...events].sort((a, b) => {
    const aIndex = eventOrder.indexOf(a.eventName);
    const bIndex = eventOrder.indexOf(b.eventName);
    return (aIndex === -1 ? eventOrder.length : aIndex) - (bIndex === -1 ? eventOrder.length : bIndex);
  });
  const max = Math.max(1, ...events.map((event) => event.registrations));
  return (
    <div className="event-bars">
      {sortedEvents.map((event) => (
        <div key={event.eventId}>
          <span>{event.eventName}</span>
          <div>
            <i style={{ width: `${(event.registrations / max) * 100}%` }} />
          </div>
          <strong>{event.registrations}</strong>
        </div>
      ))}
    </div>
  );
}

export function Metric({ label, value, tone = 'blue' }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function Status({ value }) {
  return <span className={`status-pill status-pill--${value}`}>{value}</span>;
}

export function Skeleton() {
  return <div className="admin-skeleton">Loading operational data...</div>;
}
