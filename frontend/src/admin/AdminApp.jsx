import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import DashboardLayout from '../dashboard-layout';
import { DashboardContent } from '../components/bionis/dashboard-content';
import { getApiBase, apiUrl } from '../lib/api';
import './admin.css';

const apiBase = getApiBase();
const apiPath = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!apiBase && !import.meta.env.DEV) {
    throw new Error('VITE_API_URL is not configured. Set it to the deployed backend URL, for example https://api.noctivus.site');
  }
  return `${apiBase}${normalizedPath}`;
};
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const tabs = ['Dashboard', 'Verify Members', 'Check-in', 'Events', 'Event Scheduler', 'Invitations', 'Announcements', 'AI Analysis', 'Export', 'Audit Log', 'Admin Access'];
const statuses = ['pending', 'confirmed', 'mismatch', 'duplicate'];
const adminFetch = (url, options = {}) => fetch(url, { credentials: 'include', ...options, headers: options.headers });

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [overview, setOverview] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const authHeaders = useMemo(() => ({}), []);
  const isLoginRoute = window.location.pathname.startsWith('/login');
  const allowedTabs = session?.user?.tabs;
  const visibleTabs = useMemo(() => tabs.filter((tab) => (allowedTabs || []).includes(tab)), [allowedTabs]);
  const can = (tab) => (allowedTabs || []).includes(tab);

  useEffect(() => {
    let active = true;
    adminFetch(apiUrl('/api/admin/me'))
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        if (data?.user) setSession({ user: data.user });
        setAuthChecked(true);
      })
      .catch(() => active && setAuthChecked(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (session && visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
  }, [session, visibleTabs, activeTab]);

  useEffect(() => {
    if (!session) return undefined;
    refresh();
  }, [session, eventId, status]);

  const saveSession = (data) => {
    setSession(data);
  };

  const logout = async () => {
    try {
      window.google?.accounts?.id?.disableAutoSelect?.();
      await adminFetch(apiUrl('/api/admin/logout'), { method: 'POST' });
    } catch {
      window.google?.accounts?.id?.disableAutoSelect?.();
    }
    setSession(null);
    setAuthChecked(true);
    window.location.replace('/login');
  };

  const refresh = async () => {
    setMessage('');
    try {
      const needsOverview = ['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export'].some(can);
      const needsRegistrations = ['Verify Members', 'Invitations', 'Export'].some(can);
      const [overviewResponse, registrationsResponse] = await Promise.all([
        needsOverview ? adminFetch(apiUrl('/api/admin/overview'), { headers: authHeaders }) : Promise.resolve(null),
        needsRegistrations ? adminFetch(apiUrl(`/api/admin/registrations?${new URLSearchParams({ ...(eventId && { eventId }), ...(status && { status }) })}`), { headers: authHeaders }) : Promise.resolve(null),
      ]);
      if (overviewResponse?.status === 401 || registrationsResponse?.status === 401) return logout();
      if (overviewResponse?.ok) setOverview(await overviewResponse.json());
      if (registrationsResponse?.ok) {
        const registrationsData = await registrationsResponse.json();
        setRegistrations(registrationsData.registrations || []);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to load admin data. Check the API connection and try again.';
      setMessage(detail);
    }
  };

  if (!authChecked) return <div className="admin-loading">Checking admin session...</div>;

  if (!session && !isLoginRoute) {
    window.location.replace('/login');
    return <div className="admin-loading">Redirecting to login...</div>;
  }

  if (!session) return <Login onSession={saveSession} />;

  if (isLoginRoute) {
    window.location.replace('/admin');
    return <div className="admin-loading">Opening admin panel...</div>;
  }

  return (
    <DashboardLayout
      activeTab={activeTab}
      visibleTabs={visibleTabs}
      sidebarOpen={sidebarOpen}
      user={session.user}
      onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
      onRefresh={refresh}
      onLogout={logout}
      onMenuToggle={() => setSidebarOpen((open) => !open)}
    >
        {message && <p className="admin-message">{message}</p>}
        {activeTab === 'Dashboard' && can('Dashboard') && <Dashboard overview={overview} onRefresh={refresh} authHeaders={authHeaders} />}
        {activeTab === 'Verify Members' && can('Verify Members') && <Verify registrations={registrations} overview={overview} authHeaders={authHeaders} onChanged={refresh} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} selected={selected} setSelected={setSelected} />}
        {activeTab === 'Check-in' && can('Check-in') && <CheckIn authHeaders={authHeaders} />}
        {activeTab === 'Events' && can('Events') && <EventsTab authHeaders={authHeaders} onEventChanged={refresh} />}
        {activeTab === 'Event Scheduler' && can('Event Scheduler') && <EventSchedulerTab authHeaders={authHeaders} />}
        {activeTab === 'Audit Log' && can('Audit Log') && <AuditLog authHeaders={authHeaders} />}
        {activeTab === 'Invitations' && can('Invitations') && <Invitations overview={overview} authHeaders={authHeaders} onSent={(count) => { setMessage(`${count} invitation emails queued.`); refresh(); }} />}
        {activeTab === 'Announcements' && can('Announcements') && <Announcements authHeaders={authHeaders} />}
        {activeTab === 'AI Analysis' && can('AI Analysis') && <Analysis overview={overview} authHeaders={authHeaders} />}
        {activeTab === 'Export' && can('Export') && <Export overview={overview} authHeaders={authHeaders} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} />}
        {activeTab === 'Admin Access' && can('Admin Access') && <AdminAccess authHeaders={authHeaders} onChanged={(text) => setMessage(text)} />}
    </DashboardLayout>
  );
}

function EventsTab({ authHeaders, onEventChanged }) {
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
    <section className="admin-panel events-admin-container">
      <div className="events-toolbar">
        <div>
          <h2>Event Management &amp; Status Controls</h2>
          <p className="admin-help" style={{ margin: '4px 0 0' }}>
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

      <div className="admin-filters" style={{ margin: '4px 0' }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Search events</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event name, category, or venue..."
          />
        </label>
        <label className="field" style={{ width: '180px' }}>
          <span>Status Filter</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Events ({items.length})</option>
            <option value="open">Open Only ({openCount})</option>
            <option value="closed">Closed Only ({closedCount})</option>
          </select>
        </label>
      </div>

      {message && <p className="admin-message">{message}</p>}

      <div className="admin-event-list" style={{ display: 'grid', gap: '16px' }}>
        {filteredItems.length === 0 ? (
          <p className="admin-empty">No events match the selected search or filter.</p>
        ) : (
          filteredItems.map((event) => {
            const effStatus = event.effectiveStatus || event.status || 'open';
            const isOpen = effStatus === 'open';
            const isSaving = savingId === event.id;

            return (
              <article className="event-card-expanded" key={event.id}>
                <div className="event-card-header-bar">
                  <div className="event-card-title-group">
                    <h3>{event.name}</h3>
                    {event.category && <span className="category-pill">{event.category}</span>}
                    <span className="event-card-badge-venue">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {drafts[event.id]?.venue || event.venue || 'No venue assigned'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Rs.{event.fee} · {event.registrationCount || 0} registrations
                    </span>
                  </div>

                  <div className="event-card-status-actions">
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
                      {isSaving ? 'Updating...' : isOpen ? '🔴 Close Event' : '🟢 Open Event'}
                    </button>
                  </div>
                </div>

                <div className="event-pass-fields">
                  <label className="field">
                    <span>Venue Location</span>
                    <input
                      value={drafts[event.id]?.venue || ''}
                      onChange={(e) => changeDraft(event.id, 'venue', e.target.value)}
                      placeholder="e.g. CSE Cyber Lab 1 / Main Auditorium"
                    />
                  </label>
                  <label className="field">
                    <span>Date</span>
                    <input
                      value={drafts[event.id]?.date || ''}
                      onChange={(e) => changeDraft(event.id, 'date', e.target.value)}
                      placeholder="26 Sep 2026"
                    />
                  </label>
                  <label className="field">
                    <span>Time</span>
                    <input
                      value={drafts[event.id]?.time || ''}
                      onChange={(e) => changeDraft(event.id, 'time', e.target.value)}
                      placeholder="09:00 AM"
                    />
                  </label>
                  <label className="field">
                    <span>Gate</span>
                    <input
                      value={drafts[event.id]?.gate || ''}
                      onChange={(e) => changeDraft(event.id, 'gate', e.target.value)}
                      placeholder="VEC Gate 1"
                    />
                  </label>
                  <label className="field">
                    <span>Terminal / Hall</span>
                    <input
                      value={drafts[event.id]?.terminal || ''}
                      onChange={(e) => changeDraft(event.id, 'terminal', e.target.value)}
                      placeholder="MAIN HALL"
                    />
                  </label>
                  <label className="field">
                    <span>Seat Type</span>
                    <input
                      value={drafts[event.id]?.seatType || ''}
                      onChange={(e) => changeDraft(event.id, 'seatType', e.target.value)}
                      placeholder="VIP"
                    />
                  </label>
                  <label className="field field-checkbox">
                    <input
                      type="checkbox"
                      checked={drafts[event.id]?.passActive !== false}
                      onChange={(e) => changeDraft(event.id, 'passActive', e.target.checked)}
                    />
                    <span>Pass active</span>
                  </label>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={isSaving}
                    onClick={() => save(event, drafts[event.id])}
                  >
                    {isSaving ? 'Saving...' : 'Save details'}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function CheckIn({ authHeaders }) {
  const [registrationId, setRegistrationId] = useState('');
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState({ confirmed: 0, checkedIn: 0 });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [walkIn, setWalkIn] = useState({ name: '', college: '', eventId: '' });
  const [verifiedModalData, setVerifiedModalData] = useState(null);
  const scannerRef = useRef(null);

  const extractCleanId = (raw) => {
    const trimmed = (raw || '').trim();
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsed = new URL(trimmed);
        const segments = parsed.pathname.split('/').filter(Boolean);
        return segments[segments.length - 1] || trimmed;
      }
    } catch {
      // ignore
    }
    if (trimmed.includes('/')) {
      const segments = trimmed.split('/').filter(Boolean);
      return segments[segments.length - 1] || trimmed;
    }
    return trimmed;
  };

  const load = async () => {
    const response = await adminFetch(apiPath('/api/admin/check-in/summary'), { headers: authHeaders });
    if (response.ok) setSummary(await response.json());
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let active = true;
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!active) return;
      const scanner = new Html5Qrcode('admin-qr-reader');
      scannerRef.current = scanner;
      return scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (value) => {
        const clean = extractCleanId(value);
        setRegistrationId(clean);
        setCameraOpen(false);
        performCheckIn(clean);
      }, () => {}).catch((error) => setResult({ ok: false, message: error?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access, then try again.' : 'Camera could not start. Use HTTPS or localhost and enter the registration ID manually.' }));
    }).catch(() => setResult({ ok: false, message: 'QR scanner could not load. Enter the registration ID manually.' }));
    return () => { active = false; const scanner = scannerRef.current; scannerRef.current = null; if (scanner) scanner.stop().catch(() => {}).finally(() => scanner.clear().catch(() => {})); };
  }, [cameraOpen]);

  const performCheckIn = async (idToScan) => {
    const cleanId = extractCleanId(idToScan);
    if (!cleanId) return;
    const response = await adminFetch(apiPath(`/api/admin/check-in/${encodeURIComponent(cleanId)}`), { method: 'POST', headers: authHeaders });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      const reg = data.registration || {};
      const p = reg.participant || {};
      setResult({
        ok: true,
        status: data.status,
        message: data.status === 'already-checked-in'
          ? `Already checked in at ${new Date(data.checkedInAt || reg.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${p.name || reg.registrationId}`
          : `✅ Checked in successfully: ${p.name || reg.registrationId} (${p.college || ''})`,
        registration: reg,
      });
      setVerifiedModalData(reg);
      load();
    } else {
      setResult({
        ok: false,
        status: 'error',
        message: data.detail || data.message || `Check-in failed (${response.status}).`,
      });
    }
    setRegistrationId('');
  };

  const scan = async (event) => {
    if (event) event.preventDefault();
    await performCheckIn(registrationId);
  };

  const createWalkIn = async (event) => {
    event.preventDefault();
    const response = await adminFetch(apiPath('/api/admin/walk-ins'), {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant: { name: walkIn.name, college: walkIn.college }, eventId: walkIn.eventId }),
    });
    const data = await response.json().catch(() => ({}));
    setResult({
      ok: response.ok,
      message: response.ok ? `Walk-in created: ${data.registration?.registrationId}` : data.detail || data.message || 'Unable to create walk-in.',
    });
    if (response.ok) setWalkIn({ name: '', college: '', eventId: '' });
  };

  return (
    <section className="admin-panel check-in-panel">
      <h2>Check-in desk</h2>
      <p>Scan the registration QR code or enter the registration ID / token to check in participants.</p>
      {cameraOpen && <div id="admin-qr-reader" className="check-in-camera" aria-label="QR scanner camera" />}
      <div className="check-in-actions">
        <button className="button button-secondary" type="button" onClick={() => setCameraOpen((open) => !open)}>
          {cameraOpen ? 'Close camera' : 'Open camera'}
        </button>
        <small>Camera QR scanning loads only when opened</small>
      </div>
      <form onSubmit={scan} className="admin-form">
        <input
          value={registrationId}
          onChange={(event) => setRegistrationId(event.target.value)}
          placeholder="Scan QR or enter NOC26-XXXXXX"
          autoFocus
        />
        <button className="button button-primary" disabled={!registrationId.trim()}>
          Check in
        </button>
      </form>
      {result && (
        <div style={{
          marginTop: 14,
          padding: '12px 16px',
          borderRadius: 8,
          background: result.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: result.ok ? '#4ade80' : '#f87171',
          border: `1px solid ${result.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <strong style={{ display: 'block', fontSize: 15 }}>{result.message}</strong>
          {result.registration && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1' }}>
              <span>Events: {(result.registration.eventRegistrations || []).map((e) => e.eventName).join(', ')}</span>
              <span style={{ marginLeft: 12 }}>ID: {result.registration.registrationId}</span>
            </div>
          )}
        </div>
      )}
      <div className="admin-metrics">
        <article>
          <span>Checked in</span>
          <strong>{summary.checkedIn}</strong>
        </article>
        <article>
          <span>Confirmed</span>
          <strong>{summary.confirmed}</strong>
        </article>
      </div>
      <details className="walk-in-form">
        <summary>Manual walk-in registration</summary>
        <form onSubmit={createWalkIn} className="admin-form">
          <input required value={walkIn.name} onChange={(event) => setWalkIn({ ...walkIn, name: event.target.value })} placeholder="Participant name" />
          <input required value={walkIn.college} onChange={(event) => setWalkIn({ ...walkIn, college: event.target.value })} placeholder="College" />
          <input required value={walkIn.eventId} onChange={(event) => setWalkIn({ ...walkIn, eventId: event.target.value })} placeholder="Event ID e.g. ideathon" />
          <button className="button button-primary">Create walk-in</button>
        </form>
      </details>

      {/* Verified Member Details Popup Modal */}
      {verifiedModalData && (
        <div className="admin-modal-overlay" onClick={() => setVerifiedModalData(null)}>
          <div className="verified-checkin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="verified-modal-badges">
              <span className="badge-authentic">✓ AUTHENTIC PASS</span>
              <span className="badge-verified">
                Payment {verifiedModalData.paymentStatus === 'confirmed' ? 'Verified' : verifiedModalData.paymentStatus}
              </span>
            </div>

            <div className="verified-modal-passenger">
              <span className="verified-label">PASSENGER NAME</span>
              <h2>{verifiedModalData.participant?.name || 'Participant'}</h2>
              <span className="verified-college">{verifiedModalData.participant?.college || 'Institution'}</span>
            </div>

            <div className="verified-modal-grid2">
              <div className="verified-info-box">
                <span className="verified-label">REGISTRATION ID</span>
                <strong className="reg-id-val">{verifiedModalData.registrationId}</strong>
              </div>
              <div className="verified-info-box">
                <span className="verified-label">DATE</span>
                <strong className="date-val">26 SEP 2026</strong>
              </div>
            </div>

            <div className="verified-modal-events">
              <span className="verified-label">REGISTERED EVENTS ({(verifiedModalData.eventRegistrations || []).length})</span>
              <div className="verified-events-list">
                {(verifiedModalData.eventRegistrations || []).map((ev, idx) => (
                  <div key={idx} className="verified-event-card">
                    <div className="verified-event-top">
                      <strong>{ev.eventName || ev.eventId}</strong>
                      <span className="event-cat-tag">{ev.category || 'Technical'}</span>
                    </div>
                    <div className="verified-event-meta">
                      <span>⏰ {ev.time || '09:00 AM'}</span>
                      <span>📍 {ev.venue || 'Main Auditorium'}</span>
                      <span>🚪 {ev.gate || 'VEC Gate 1'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="verified-status-banner">
              <div className="status-check-title">✅ Participant Checked In</div>
              <div className="status-check-time">
                Checked in at {verifiedModalData.checkedInAt ? new Date(verifiedModalData.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <button
              type="button"
              className="continue-scanning-btn"
              onClick={() => {
                setVerifiedModalData(null);
                setRegistrationId('');
                setCameraOpen(true);
              }}
            >
              ← Back to Check-in (Continue Scanning)
            </button>

            <div className="verified-modal-footer">
              Velammal Engineering College • Chennai, Tamil Nadu
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AuditLog({ authHeaders }) {
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState([]);
  const load = async () => {
    const response = await adminFetch(apiPath(`/api/admin/audit-log?${new URLSearchParams({ search })}`), { headers: authHeaders });
    if (response.ok) setActions((await response.json()).actions || []);
  };
  useEffect(() => { load(); }, []);
  return <section className="admin-panel"><h2>Audit log</h2><div className="admin-form"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actor, action, target" /><button className="button button-secondary" onClick={load}>Search</button></div>{actions.length === 0 ? <p className="admin-empty">No audit records found.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>{actions.map((action, index) => <tr key={`${action.createdAt}-${index}`}><td>{action.createdAt ? new Date(action.createdAt).toLocaleString() : '—'}</td><td>{action.actor}</td><td>{action.action}</td><td>{action.target}</td></tr>)}</tbody></table></div>}</section>;
}

function Announcements({ authHeaders }) {
  const [form, setForm] = useState({ subject: '', message: '', audience: 'confirmed', channel: 'email' });
  const [result, setResult] = useState('');
  const send = async (event) => {
    event.preventDefault();
    const response = await adminFetch(apiPath('/api/admin/announcements/send'), { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    setResult(response.ok ? `${data.queued} email(s) queued.` : data.detail || data.message || 'Unable to send announcement.');
  };
  return <form className="admin-panel announcement-panel" onSubmit={send}><h2>Announcements</h2><label className="field"><span>Subject</span><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label className="field"><span>Message</span><textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows="8" /></label><label className="field"><span>Audience</span><select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="confirmed">All confirmed</option><option value="checked-in">Checked in</option></select></label><p className="admin-message">SMS is unavailable until a provider is configured.</p>{result && <p className="admin-message">{result}</p>}<button className="button button-primary" disabled={!form.subject || !form.message}>Queue email broadcast</button></form>;
}

function Login({ onSession }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [buttonReady, setButtonReady] = useState(false);

  useEffect(() => {
    if (!googleClientId) {
      setLoading(false);
      setError('Google sign-in is not configured in this frontend. Restart Vite after setting VITE_GOOGLE_CLIENT_ID.');
      return undefined;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const script = existing || document.createElement('script');
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setError('Google sign-in timed out. Check your network connection and allow accounts.google.com.');
    }, 8000);
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    const initializeGoogle = () => {
      if (timedOut) return;
      try {
        if (!window.google?.accounts?.id) throw new Error('Google sign-in is unavailable.');
        window.google.accounts.id.disableAutoSelect?.();
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            setLoading(true);
            try {
              const response = await adminFetch(apiPath('/api/admin/auth/google'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data.detail || data.message || `Google sign-in failed (${response.status}).`);
              onSession(data);
              window.location.replace('/admin');
            } catch (loginError) {
              const message = loginError instanceof TypeError
                ? 'Admin API unavailable. Start the backend on localhost:4000 and try again.'
                : loginError.message;
              setError(message);
            } finally { setLoading(false); }
          },
        });
        const target = document.getElementById('google-admin-login');
        if (!target) throw new Error('Google sign-in button could not be mounted.');
        window.google.accounts.id.renderButton(target, { theme: 'filled_black', size: 'large', width: 320 });
        setButtonReady(true);
        window.clearTimeout(timeout);
        setLoading(false);
      } catch (initError) { window.clearTimeout(timeout); setLoading(false); setError(initError.message || 'Google sign-in could not initialize.'); }
    };
    script.onerror = () => { window.clearTimeout(timeout); setLoading(false); setError('Google sign-in could not load. Check your internet connection or allow accounts.google.com.'); };
    if (window.google?.accounts?.id) initializeGoogle();
    else {
      script.addEventListener('load', initializeGoogle, { once: true });
      if (!existing) document.head.appendChild(script);
    }
    return () => { window.clearTimeout(timeout); script.removeEventListener('load', initializeGoogle); };
  }, [onSession]);

  const handleDevLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminFetch(apiPath('/api/admin/auth/dev'), { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.message || 'Dev login failed.');
      onSession(data);
      window.location.replace('/admin');
    } catch (err) {
      setError(err.message || 'Dev login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login">
      <section>
        <img src="/brand/noctivus-emblem.webp" alt="" />
        <span className="kicker">SECURE ADMIN ACCESS</span>
        <h1>Noctivus operations</h1>
        <a className="admin-login__home" href="/">Back to home</a>
        {googleClientId ? <div id="google-admin-login" aria-busy={loading} /> : <p className="form-error" role="alert">Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to enable Google login.</p>}
        {loading && !buttonReady && <p className="admin-login__status">Connecting to Google sign-in…</p>}
        {import.meta.env.DEV && (
          <div className="dev-quick-login-card">
            <small style={{ color: '#94a3b8' }}>Local Development Mode</small>
            <button type="button" className="button dev-login-btn" onClick={handleDevLogin} disabled={loading}>
              ⚡ Quick Admin Login (Dev)
            </button>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}

function Dashboard({ overview, onRefresh, authHeaders }) {
  if (!overview) return <Skeleton />;
  const handleToggleEventStatus = async (eventId, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    const response = await adminFetch(apiPath(`/api/admin/events/${eventId}`), {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok && onRefresh) onRefresh();
  };
  return <DashboardContent overview={overview} onToggleEventStatus={handleToggleEventStatus} />;
}

function Verify({ registrations, overview, authHeaders, onChanged, eventId, setEventId, status, setStatus, selected, setSelected }) {
  const [notes, setNotes] = useState({});
  const [search, setSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);
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
          [registrationId]: data.registration.payment_email_status === 'sent'
            ? 'Payment confirmed. Receipt sent to member.'
            : 'Payment confirmed, but email failed to send.',
        }));
        if (onChanged) onChanged();
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const resendEmail = async (registrationId) => {
    setResendingId(registrationId);
    try {
      const response = await adminFetch(apiPath(`/api/admin/registrations/${registrationId}/resend-confirmation-email`), {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.registration) {
        setFeedback((prev) => ({
          ...prev,
          [registrationId]: data.registration.payment_email_status === 'sent'
            ? 'Payment confirmed. Receipt sent to member.'
            : 'Payment confirmed, but email failed to send.',
        }));
        if (onChanged) onChanged();
      }
    } finally {
      setResendingId(null);
    }
  };

  return (
    <>
      <div className="admin-filters">
        <label className="field">
          <span>Search</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, UTR" />
        </label>
        <Filters overview={overview} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} />
      </div>
      <div className="verify-bulk-actions">
        <button className="button button-secondary" disabled={!selected.length} onClick={async () => { await bulkVerify(authHeaders, selected, 'confirmed'); setSelected([]); onChanged(); }}>
          Confirm selected
        </button>
        <button className="button button-secondary" disabled={!selected.length} onClick={async () => { await bulkVerify(authHeaders, selected, 'mismatch'); setSelected([]); onChanged(); }}>
          Reject selected
        </button>
      </div>
      <RegistrationTable
        registrations={registrations.filter((item) => {
          const term = search.toLowerCase();
          return !term || `${item.participant?.name} ${item.participant?.email} ${item.participant?.phone} ${item.utrNumber}`.toLowerCase().includes(term);
        })}
        selected={selected}
        setSelected={setSelected}
        renderActions={(registration) => {
          const isConfirmed = registration.paymentStatus === 'confirmed';
          const emailStatus = registration.payment_email_status;
          const statusText = feedback[registration.registrationId] || (
            emailStatus === 'sent'
              ? 'Payment confirmed. Receipt sent to member.'
              : emailStatus === 'failed'
              ? 'Payment confirmed, but email failed to send.'
              : null
          );

          return (
            <div className="verify-actions-column">
              <div className="verify-actions">
                <input
                  placeholder="Verification notes"
                  value={notes[registration.registrationId] || ''}
                  onChange={(event) => setNotes((current) => ({ ...current, [registration.registrationId]: event.target.value }))}
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

              {isConfirmed && statusText && (
                <div className="payment-email-feedback">
                  <span className={`payment-email-badge ${emailStatus === 'sent' || statusText.includes('pass attached') ? 'payment-email-badge--sent' : 'payment-email-badge--failed'}`}>
                    {statusText}
                  </span>
                  {(emailStatus === 'failed' || statusText.includes('failed to send')) && (
                    <button
                      type="button"
                      className="button button-secondary button-small button-resend-inline"
                      disabled={resendingId === registration.registrationId}
                      onClick={() => resendEmail(registration.registrationId)}
                    >
                      {resendingId === registration.registrationId ? 'Sending...' : 'Resend Email'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        }}
      />
    </>
  );
}

async function bulkVerify(authHeaders, registrationIds, status) {
  await adminFetch(apiPath('/api/admin/registrations/bulk-verify'), { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationIds, status }) });
}

function Invitations({ authHeaders, onSent }) {
  const [stats, setStats] = useState({ totalEligible: 0, sentCount: 0, failedCount: 0, unsentCount: 0 });
  const [batchCount, setBatchCount] = useState('');
  const [lastBatchResult, setLastBatchResult] = useState(null);
  const [passPreviewUrl, setPassPreviewUrl] = useState('');
  const [previewMessage, setPreviewMessage] = useState('Generating boarding pass preview...');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch(apiPath('/api/admin/invitations/stats'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // stats error fallback
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const controller = new AbortController();
    setPreviewMessage('Generating boarding pass preview...');
    adminFetch(apiPath('/api/admin/invitations/preview'), {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) return response.blob();
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.message || `Preview unavailable (${response.status}).`);
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setPassPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return url; });
        setPreviewMessage('');
      })
      .catch((previewError) => {
        if (controller.signal.aborted) return;
        setPassPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; });
        setPreviewMessage(previewError.message || 'Boarding pass preview unavailable.');
      });
    return () => controller.abort();
  }, [authHeaders]);

  const handleSendBatch = async () => {
    const count = parseInt(batchCount, 10);
    if (!count || count <= 0) {
      setError('Please enter a valid number of passes to send today (at least 1).');
      return;
    }
    setError('');
    setSending(true);
    try {
      const res = await adminFetch(apiPath('/api/admin/invitations/send-batch'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: count }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLastBatchResult(data);
        if (onSent) onSent(data.succeeded || 0);
        await fetchStats();
        setBatchCount('');
      } else {
        setError(data.detail || data.message || 'Failed to execute batch send.');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the pass dispatch service.');
    } finally {
      setSending(false);
    }
  };

  const handleResendFailed = async () => {
    if (!lastBatchResult || !lastBatchResult.failedList || lastBatchResult.failedList.length === 0) return;
    const regIds = lastBatchResult.failedList.map((item) => item.registrationId);
    setResending(true);
    setError('');
    try {
      const res = await adminFetch(apiPath('/api/admin/invitations/resend-failed'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: regIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLastBatchResult((prev) => {
          if (!prev) return data;
          const successfulIds = new Set((data.successful || []).map((s) => s.registrationId));
          const updatedSuccessful = [...prev.successful, ...(data.successful || [])];
          const updatedFailedList = data.failedList || [];
          return {
            attempted: prev.attempted,
            succeeded: updatedSuccessful.length,
            failed: updatedFailedList.length,
            successful: updatedSuccessful,
            failedList: updatedFailedList,
          };
        });
        if (onSent) onSent(data.succeeded || 0);
        await fetchStats();
      } else {
        setError(data.detail || data.message || 'Failed to resend passes.');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the pass dispatch service.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="admin-grid admin-grid--wide invitation-automation">
      <section className="admin-panel pass-builder">
        <h2>Send Boarding Passes</h2>
        <p className="admin-help">Batch send personalized symposium boarding passes to confirmed members who have not received their pass yet.</p>

        <div className="batch-stats-summary">
          <div className="batch-stat-box stat-eligible">
            <span>Eligible Confirmed</span>
            <strong>{stats.totalEligible}</strong>
          </div>
          <div className="batch-stat-box stat-sent">
            <span>Passes Sent</span>
            <strong>{stats.sentCount}</strong>
          </div>
          <div className="batch-stat-box stat-unsent">
            <span>Pending Unsent</span>
            <strong>{stats.unsentCount}</strong>
          </div>
          <div className="batch-stat-box stat-failed">
            <span>Failed</span>
            <strong>{stats.failedCount}</strong>
          </div>
        </div>

        <div className="batch-send-form">
          <label className="field">
            <span>Number of passes to send today</span>
            <div className="batch-input-row">
              <input
                type="number"
                min="1"
                placeholder="e.g. 10"
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                disabled={sending || stats.unsentCount === 0}
              />
              <button
                type="button"
                className="button button-primary batch-send-btn"
                disabled={!batchCount || parseInt(batchCount, 10) <= 0 || sending || stats.unsentCount === 0}
                onClick={handleSendBatch}
              >
                {sending ? 'Sending Batch...' : 'Send Batch'} <Icon name="mail" />
              </button>
            </div>
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        {lastBatchResult && (
          <div className="batch-results-panel">
            <div className="batch-results-header">
              <h3>Batch Send Results</h3>
              <small>Attempted: {lastBatchResult.attempted}</small>
            </div>

            <div className="batch-counts-row">
              <div className="batch-count-card success-card">
                <span>Successfully sent:</span>
                <strong>{lastBatchResult.succeeded}</strong>
              </div>
              <div className="batch-count-card failed-card">
                <span>Failed:</span>
                <strong>{lastBatchResult.failed}</strong>
              </div>
            </div>

            <details className="batch-details-section" open={(lastBatchResult.successful || []).length > 0}>
              <summary>Successful sends ({(lastBatchResult.successful || []).length})</summary>
              <div className="batch-list-items">
                {(lastBatchResult.successful || []).length === 0 ? (
                  <p className="admin-help" style={{ margin: '6px 0' }}>No successful sends in this batch.</p>
                ) : (
                  (lastBatchResult.successful || []).map((item) => (
                    <div key={item.registrationId} className="batch-item-row">
                      <div className="member-info">
                        <span className="member-name">{item.name} <small>({item.registrationId})</small></span>
                        <span className="member-email">{item.email}</span>
                      </div>
                      <span className="batch-success-badge">Sent</span>
                    </div>
                  ))
                )}
              </div>
            </details>

            <details className="batch-details-section" open={(lastBatchResult.failedList || []).length > 0}>
              <summary>
                <span>Failed sends ({(lastBatchResult.failedList || []).length})</span>
              </summary>
              {(lastBatchResult.failedList || []).length > 0 && (
                <div className="failed-summary-wrap">
                  <span style={{ fontSize: '12px', color: '#fca5a5' }}>{(lastBatchResult.failedList || []).length} failed send{(lastBatchResult.failedList || []).length === 1 ? '' : 's'}</span>
                  <button
                    type="button"
                    className="button-resend-failed"
                    disabled={resending || (lastBatchResult.failedList || []).length === 0}
                    onClick={handleResendFailed}
                  >
                    {resending ? 'Resending...' : 'Resend Failed'} <Icon name="refresh" />
                  </button>
                </div>
              )}
              <div className="batch-list-items">
                {(lastBatchResult.failedList || []).length === 0 ? (
                  <p className="admin-help" style={{ margin: '6px 0' }}>No failed passes.</p>
                ) : (
                  (lastBatchResult.failedList || []).map((item) => (
                    <div key={item.registrationId} className="batch-item-row">
                      <div className="member-info">
                        <span className="member-name">{item.name} <small>({item.registrationId})</small></span>
                        <span className="member-email">{item.email}</span>
                      </div>
                      <span className="batch-failure-badge" title={item.reason}>{item.reason}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          </div>
        )}
      </section>

      <section className="admin-panel pass-sample">
        <div className="boarding-pass-card">
          {passPreviewUrl && <img className="boarding-pass-render" src={passPreviewUrl} alt="Personalized symposium boarding pass sample" />}
          {!passPreviewUrl && <div className="boarding-pass-empty">{previewMessage}</div>}
        </div>
      </section>
    </div>
  );
}

function EventSchedulerTab({ authHeaders }) {
  const [data, setData] = useState({ events: [], total_slots: 0, has_generated_slots: false, last_assignment_summary: null });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState(null);
  const [assignmentSummary, setAssignmentSummary] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [addingSlotEvent, setAddingSlotEvent] = useState(null);
  const [slotForm, setSlotForm] = useState({ window: 'morning', start_time: '09:00', end_time: '10:30', capacity: 30, date: '2026-09-26' });
  const [slotSaving, setSlotSaving] = useState(false);

  const load = async () => {
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler'), { headers: authHeaders });
      const res = await response.json().catch(() => ({}));
      if (response.ok) {
        setData(res);
        if (res.last_assignment_summary) {
          setAssignmentSummary(res.last_assignment_summary);
        }
      } else {
        setMessage({ type: 'error', text: res.detail || res.message || 'Unable to load scheduler data.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect to scheduler service.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerateSlots = async (regenerate = false) => {
    setGenerating(true);
    setMessage(null);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/generate-slots'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to generate slots.');
      setMessage({ type: 'success', text: regenerate ? 'Slots regenerated and previous assignments reset.' : res.message || 'Time slots generated successfully.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleRunAssignment = async () => {
    if (!data.has_generated_slots) {
      setMessage({ type: 'error', text: 'Generate slots first before running assignment.' });
      return;
    }
    setAssigning(true);
    setMessage(null);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/run-assignment'), {
        method: 'POST',
        headers: authHeaders,
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to run member assignment.');
      setAssignmentSummary(res);
      setMessage({
        type: 'success',
        text: `Assignment batch finished: ${res.successfully_assigned} members assigned successfully (${res.total_processed} processed).`,
      });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAssigning(false);
    }
  };

  const openEditSlot = (slot) => {
    setEditingSlot(slot);
    setSlotForm({
      window: slot.window || 'morning',
      start_time: slot.start_time || '09:00',
      end_time: slot.end_time || '10:30',
      capacity: slot.capacity || 30,
      date: slot.date || '2026-09-26',
    });
  };

  const openAddSlot = (eventObj) => {
    setAddingSlotEvent(eventObj);
    setSlotForm({
      window: 'morning',
      start_time: '09:00',
      end_time: '10:30',
      capacity: 30,
      date: eventObj.date || '2026-09-26',
    });
  };

  const saveEditedSlot = async (e) => {
    e.preventDefault();
    if (!editingSlot) return;
    setSlotSaving(true);
    try {
      const response = await adminFetch(apiPath(`/api/admin/scheduler/slots/${editingSlot.id}`), {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(slotForm),
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to update slot.');
      setMessage({ type: 'success', text: `Slot ${editingSlot.id} updated successfully.` });
      setEditingSlot(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSlotSaving(false);
    }
  };

  const createNewSlot = async (e) => {
    e.preventDefault();
    if (!addingSlotEvent) return;
    setSlotSaving(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/slots'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: addingSlotEvent.id,
          ...slotForm,
        }),
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to create slot.');
      setMessage({ type: 'success', text: `New slot added for ${addingSlotEvent.name}.` });
      setAddingSlotEvent(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSlotSaving(false);
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/export'), {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to export schedule to Excel.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Noctivus26_Event_Schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setExporting(false);
    }
  };

  const deleteExistingSlot = async (slotId) => {
    if (!window.confirm(`Are you sure you want to delete slot ${slotId}?`)) return;
    try {
      const response = await adminFetch(apiPath(`/api/admin/scheduler/slots/${slotId}`), {
        method: 'DELETE',
        headers: authHeaders,
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to delete slot.');
      setMessage({ type: 'success', text: `Slot ${slotId} deleted.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const [managingEventSlots, setManagingEventSlots] = useState(null);

  if (loading) {
    return <section className="admin-panel"><p className="admin-loading-text">Loading Event Scheduler...</p></section>;
  }

  return (
    <div className="admin-panel scheduler-panel-v2">
      <header className="scheduler-header">
        <div>
          <h2>Event Scheduler</h2>
          <p className="admin-help">Auto-generate conflict-free time slots and assign registered members with zero time overlap.</p>
        </div>
        <div className="scheduler-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={handleExportExcel}
            disabled={exporting || !data.has_generated_slots}
            title="Download complete schedule as Excel (.xlsx) workbook with Morning & Afternoon slots"
          >
            {exporting ? 'Exporting Excel...' : 'Download Excel'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => handleGenerateSlots(data.has_generated_slots)}
            disabled={generating || assigning}
          >
            {generating ? 'Generating slots...' : data.has_generated_slots ? 'Regenerate Slots' : 'Generate Slots'}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleRunAssignment}
            disabled={!data.has_generated_slots || assigning || generating}
            title={!data.has_generated_slots ? 'Generate slots first before running assignment' : 'Assign registered members into slots'}
          >
            {assigning ? 'Assigning members...' : 'Run Assignment'}
          </button>
        </div>
      </header>

      {message && (
        <div className={`admin-alert ${message.type === 'error' ? 'admin-alert--error' : 'admin-alert--success'}`}>
          <Icon name={message.type === 'error' ? 'shield' : 'check'} size={18} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Events & Slot Overview Table */}
      <section className="scheduler-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h3>Events Overview</h3>
          <small style={{ color: 'var(--muted)' }}>Slots auto-scale to accommodate all registered participants</small>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table scheduler-events-table">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Total Registrations</th>
                <th>Slots Generated</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <strong>{ev.name}</strong>
                    {ev.is_ctf && <span className="badge badge-ctf" style={{ marginLeft: 8 }}>CTF</span>}
                  </td>
                  <td>
                    <span className={`badge ${ev.category === 'tech' || ev.category === 'Technical' ? 'badge-tech' : 'badge-nontech'}`}>
                      {ev.category}
                    </span>
                  </td>
                  <td>{ev.duration_minutes} mins</td>
                  <td>
                    <strong style={{ color: ev.total_registrations > 0 ? '#4ade80' : 'var(--text)' }}>
                      {ev.total_registrations}
                    </strong>
                  </td>
                  <td><strong>{ev.slots_count}</strong> slots</td>
                  <td>
                    <span className={`status-pill ${ev.slots_count > 0 ? 'status-pill--ready' : 'status-pill--pending'}`}>
                      {ev.slots_count > 0 ? 'Slots Ready' : 'No Slots'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="button button-primary button-small"
                        onClick={() => setManagingEventSlots(ev)}
                        title="View and edit all slots for this event"
                      >
                        Edit Slots
                      </button>
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => openAddSlot(ev)}
                        title="Add a new custom slot"
                      >
                        + Add Slot
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Results Panel */}
      {assignmentSummary && (
        <section className="scheduler-section scheduler-results-panel">
          <h3>Assignment Results</h3>
          <div className="admin-metrics scheduler-metrics">
            <article>
              <span>Total Processed</span>
              <strong>{assignmentSummary.total_processed ?? 0}</strong>
            </article>
            <article className="metric--success">
              <span>Successfully Assigned</span>
              <strong>{assignmentSummary.successfully_assigned ?? 0}</strong>
            </article>
            <article className="metric--warning">
              <span>Unassigned (Time Conflicts)</span>
              <strong>{assignmentSummary.unassigned_conflicts?.length ?? 0}</strong>
            </article>
            <article className="metric--danger">
              <span>Unassigned (Slots Full)</span>
              <strong>{assignmentSummary.unassigned_full?.length ?? 0}</strong>
            </article>
          </div>

          <div className="scheduler-unassigned-details">
            <details className="unassigned-group">
              <summary>
                <strong>Unassigned due to time conflicts ({assignmentSummary.unassigned_conflicts?.length ?? 0})</strong>
              </summary>
              {(!assignmentSummary.unassigned_conflicts || assignmentSummary.unassigned_conflicts.length === 0) ? (
                <p className="admin-empty-sub">No conflict unassigned members.</p>
              ) : (
                <ul className="member-id-list">
                  {assignmentSummary.unassigned_conflicts.map((id) => (
                    <li key={id}><code>{id}</code></li>
                  ))}
                </ul>
              )}
            </details>

            <details className="unassigned-group">
              <summary>
                <strong>Unassigned due to full slots ({assignmentSummary.unassigned_full?.length ?? 0})</strong>
              </summary>
              {(!assignmentSummary.unassigned_full || assignmentSummary.unassigned_full.length === 0) ? (
                <p className="admin-empty-sub">No members unassigned due to full capacity.</p>
              ) : (
                <ul className="member-id-list">
                  {assignmentSummary.unassigned_full.map((id) => (
                    <li key={id}><code>{id}</code></li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        </section>
      )}

      {/* Schedule View per Event */}
      <section className="scheduler-section">
        <h3>Schedule View</h3>
        {!data.has_generated_slots ? (
          <p className="admin-empty">No slots generated yet. Click &quot;Generate Slots&quot; above to create morning and afternoon time windows.</p>
        ) : (
          <div className="scheduler-events-grid">
            {data.events.map((ev) => (
              <div className="scheduler-event-card" key={ev.id}>
                <div className="scheduler-event-card__header">
                  <div>
                    <h4>{ev.name}</h4>
                    <small>{ev.category} · {ev.duration_minutes} mins / slot</small>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => openAddSlot(ev)}
                    >
                      + Add Slot
                    </button>
                    <span className="badge badge-slots">{ev.slots_count} slots</span>
                  </div>
                </div>

                <div className="scheduler-slots-table-wrap">
                  <table className="admin-table scheduler-slots-table">
                    <thead>
                      <tr>
                        <th>Window</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Capacity</th>
                        <th>Assigned</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.slots.map((slot) => {
                        const assignedCount = slot.assigned_member_ids?.length || 0;
                        const capacity = slot.capacity || 30;
                        const fillPercent = Math.min(100, Math.round((assignedCount / capacity) * 100));
                        return (
                          <tr key={slot.id}>
                            <td>
                              <span className={`window-tag window-tag--${slot.window}`}>
                                {slot.window === 'morning' ? 'Morning' : 'Afternoon'}
                              </span>
                            </td>
                            <td><code>{slot.start_time}</code></td>
                            <td><code>{slot.end_time}</code></td>
                            <td>
                              <div className="slot-capacity-bar-wrap">
                                <div className="slot-capacity-bar" style={{ width: `${fillPercent}%` }} />
                                <span>{assignedCount} / {capacity}</span>
                              </div>
                            </td>
                            <td>
                              {assignedCount === 0 ? (
                                <span className="text-muted">Empty</span>
                              ) : (
                                <details className="slot-members-popover">
                                  <summary>{assignedCount} member(s)</summary>
                                  <ul>
                                    {slot.assigned_member_ids.map((mid) => (
                                      <li key={mid}>{mid}</li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="button button-secondary button-small"
                                  onClick={() => openEditSlot(slot)}
                                  title="Edit slot timing and capacity"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="button button-danger button-small"
                                  onClick={() => deleteExistingSlot(slot.id)}
                                  title="Delete this slot"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit Slot Modal */}
      {editingSlot && (
        <div className="modal-shell" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setEditingSlot(null)}>
          <div className="admin-modal-card" role="dialog" aria-labelledby="edit-slot-title">
            <header className="admin-modal-card__header">
              <div>
                <span className="kicker">SLOT CONFIGURATION</span>
                <h3 id="edit-slot-title">Edit Slot: {editingSlot.id}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditingSlot(null)}>
                <Icon name="close" />
              </button>
            </header>
            <form onSubmit={saveEditedSlot} className="admin-modal-form">
              <label className="field">
                <span>Window</span>
                <select
                  value={slotForm.window}
                  onChange={(e) => setSlotForm({ ...slotForm, window: e.target.value })}
                >
                  <option value="morning">Morning (09:00 - 12:30)</option>
                  <option value="afternoon">Afternoon (13:00 - 17:00)</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Start Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.start_time}
                    onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                    placeholder="09:00"
                  />
                </label>
                <label className="field">
                  <span>End Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.end_time}
                    onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                    placeholder="10:30"
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Capacity</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={slotForm.capacity}
                    onChange={(e) => setSlotForm({ ...slotForm, capacity: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input
                    type="text"
                    required
                    value={slotForm.date}
                    onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setEditingSlot(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={slotSaving}>
                  {slotSaving ? 'Saving...' : 'Save Slot Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Slot Modal */}
      {addingSlotEvent && (
        <div className="modal-shell" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setAddingSlotEvent(null)}>
          <div className="admin-modal-card" role="dialog" aria-labelledby="add-slot-title">
            <header className="admin-modal-card__header">
              <div>
                <span className="kicker">NEW SLOT</span>
                <h3 id="add-slot-title">Add Slot for {addingSlotEvent.name}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setAddingSlotEvent(null)}>
                <Icon name="close" />
              </button>
            </header>
            <form onSubmit={createNewSlot} className="admin-modal-form">
              <label className="field">
                <span>Window</span>
                <select
                  value={slotForm.window}
                  onChange={(e) => setSlotForm({ ...slotForm, window: e.target.value })}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Start Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.start_time}
                    onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                    placeholder="09:00"
                  />
                </label>
                <label className="field">
                  <span>End Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.end_time}
                    onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                    placeholder="10:30"
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Capacity</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={slotForm.capacity}
                    onChange={(e) => setSlotForm({ ...slotForm, capacity: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input
                    type="text"
                    required
                    value={slotForm.date}
                    onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setAddingSlotEvent(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={slotSaving}>
                  {slotSaving ? 'Creating...' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Event Slots Modal */}
      {managingEventSlots && (
        <div className="modal-shell" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setManagingEventSlots(null)}>
          <div className="admin-modal-card admin-modal-card--wide" role="dialog" aria-labelledby="manage-event-slots-title">
            <header className="admin-modal-card__header">
              <div>
                <span className="kicker">MANAGE SLOTS</span>
                <h3 id="manage-event-slots-title">{managingEventSlots.name}</h3>
                <small style={{ color: 'var(--muted)' }}>
                  {managingEventSlots.category} · {managingEventSlots.duration_minutes} mins / slot · {managingEventSlots.total_registrations} Registered Members
                </small>
              </div>
              <button type="button" className="icon-button" onClick={() => setManagingEventSlots(null)}>
                <Icon name="close" />
              </button>
            </header>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px 0' }}>
              <strong>All Slots ({managingEventSlots.slots?.length || 0})</strong>
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => {
                  const ev = managingEventSlots;
                  setManagingEventSlots(null);
                  openAddSlot(ev);
                }}
              >
                + Add New Slot
              </button>
            </div>

            <div className="scheduler-slots-table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="admin-table scheduler-slots-table">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Capacity</th>
                    <th>Assigned</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.events.find((e) => e.id === managingEventSlots.id)?.slots || []).map((slot) => {
                    const assignedCount = slot.assigned_member_ids?.length || 0;
                    const capacity = slot.capacity || 30;
                    const fillPercent = Math.min(100, Math.round((assignedCount / capacity) * 100));
                    return (
                      <tr key={slot.id}>
                        <td>
                          <span className={`window-tag window-tag--${slot.window}`}>
                            {slot.window === 'morning' ? 'Morning' : 'Afternoon'}
                          </span>
                        </td>
                        <td><code>{slot.start_time}</code></td>
                        <td><code>{slot.end_time}</code></td>
                        <td>
                          <div className="slot-capacity-bar-wrap">
                            <div className="slot-capacity-bar" style={{ width: `${fillPercent}%` }} />
                            <span>{assignedCount} / {capacity}</span>
                          </div>
                        </td>
                        <td>
                          {assignedCount === 0 ? (
                            <span className="text-muted">Empty</span>
                          ) : (
                            <details className="slot-members-popover">
                              <summary>{assignedCount} member(s)</summary>
                              <ul>
                                {slot.assigned_member_ids.map((mid) => (
                                  <li key={mid}>{mid}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="button button-secondary button-small"
                              onClick={() => {
                                const s = slot;
                                setManagingEventSlots(null);
                                openEditSlot(s);
                              }}
                              title="Edit slot timing and capacity"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button button-danger button-small"
                              onClick={() => deleteExistingSlot(slot.id)}
                              title="Delete this slot"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setManagingEventSlots(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Analysis({ overview, authHeaders }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const response = await adminFetch(apiPath('/api/admin/analysis/ai'), { method: 'POST', headers: authHeaders });
    const data = await response.json();
    setAnalysis(typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2));
    setLoading(false);
  };
  return <section className="admin-panel analysis-panel"><h2>Offline analysis</h2><Dashboard overview={overview} /><button className="button button-primary" onClick={run} disabled={loading}>{loading ? 'Analyzing...' : 'Analyze registrations offline'} <Icon name="shield" /></button>{analysis && <pre>{analysis}</pre>}</section>;
}

function Export({ overview, authHeaders, eventId, setEventId, status, setStatus }) {
  const download = async () => {
    const response = await adminFetch(apiPath(`/api/admin/export?${new URLSearchParams({ ...(eventId && { eventId }), ...(status && { status }) })}`), { headers: authHeaders });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `noctivus-${eventId || 'all'}-registrations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="admin-panel export-panel"><h2>Export member details</h2><Filters overview={overview} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} /><button className="button button-primary" onClick={download}>Export CSV <Icon name="external" /></button></section>;
}

function AdminAccess({ authHeaders, onChanged }) {
  const [users, setUsers] = useState([]);
  const [availableTabs, setAvailableTabs] = useState([]);
  const [form, setForm] = useState({ email: '', name: '', tabs: ['Dashboard'] });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const response = await adminFetch(apiPath('/api/admin/access'), { headers: authHeaders });
    const data = await response.json();
    if (response.ok) {
      setUsers(data.users || []);
      setAvailableTabs(data.tabs || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleTab = (tab) => {
    setForm((current) => ({
      ...current,
      tabs: current.tabs.includes(tab) ? current.tabs.filter((item) => item !== tab) : [...current.tabs, tab],
    }));
  };

  const edit = (user) => {
    setForm({ email: user.email, name: user.name || '', tabs: user.tabs?.filter((tab) => tab !== 'Admin Access') || [] });
  };

  const save = async (event) => {
    event.preventDefault();
    setLoading(true);
    const response = await adminFetch(apiPath(`/api/admin/access/${encodeURIComponent(form.email.trim().toLowerCase())}`), {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, tabs: form.tabs, active: true }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return onChanged(data.message || 'Unable to update access.');
    setForm({ email: '', name: '', tabs: ['Dashboard'] });
    await load();
    onChanged('Admin access updated.');
  };

  const deactivate = async (email) => {
    const response = await adminFetch(apiPath(`/api/admin/access/${encodeURIComponent(email)}`), { method: 'DELETE', headers: authHeaders });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onChanged(data.message || 'Unable to remove access.');
    await load();
    onChanged('Admin access removed.');
  };

  return (
    <div className="admin-grid admin-grid--wide">
      <form className="admin-panel access-form" onSubmit={save}>
        <h2>Give access</h2>
        <label className="field"><span>Google email</span><input required maxLength="190" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="user@gmail.com" /></label>
        <label className="field"><span>Name</span><input maxLength="80" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Optional" /></label>
        <fieldset className="access-tabs">
          <legend>Allowed tabs</legend>
          {availableTabs.map((tab) => <label key={tab}><input type="checkbox" checked={form.tabs.includes(tab)} onChange={() => toggleTab(tab)} /><span>{tab}</span></label>)}
        </fieldset>
        <button className="button button-primary" type="submit" disabled={loading || !form.email || !form.tabs.length}>{loading ? 'Saving...' : 'Save access'} <Icon name="shield" /></button>
      </form>
      <section className="admin-panel access-list">
        <h2>Current admin users</h2>
        {users.length === 0 ? <p className="admin-empty">No delegated admin users found.</p> : users.map((user) => (
          <article key={user.email} className={!user.active ? 'inactive' : ''}>
            <div><strong>{user.name || user.email}</strong><small>{user.email}</small></div>
            <div className="access-list__tabs">{user.tabs?.map((tab) => <span key={tab}>{tab}</span>)}</div>
            <div className="access-list__actions">
              {user.owner ? <span className="status-pill status-pill--confirmed">Owner</span> : <><button className="button button-secondary" onClick={() => edit(user)}>Edit</button><button className="button button-secondary" onClick={() => deactivate(user.email)}>Remove</button></>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Filters({ overview, eventId, setEventId, status, setStatus }) {
  return <div className="admin-filters"><label className="field"><span>Event</span><select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">All events</option>{overview?.events.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventName}</option>)}</select></label><label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>;
}

function RegistrationTable({ registrations, selected, setSelected, renderActions }) {
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  if (registrations.length === 0) return <p className="admin-empty">No registrations match the current filters.</p>;
  return <div className="registration-table">{registrations.map((registration) => <article key={registration.registrationId}><label><input type="checkbox" checked={selected.includes(registration.registrationId)} onChange={() => toggle(registration.registrationId)} /><span>{registration.registrationId}</span></label><div><strong>{registration.participant?.name}</strong><small>{registration.participant?.college}</small></div><div><strong>{registration.eventRegistrations?.map((event) => event.eventName).join(', ')}</strong><small>{registration.participant?.email}</small></div><Status value={registration.paymentStatus} /><div><strong>Rs.{registration.expectedAmount}</strong><small>UTR {registration.utrNumber}</small></div>{renderActions?.(registration)}</article>)}</div>;
}

function RegistrationList({ registrations }) {
  return <div className="recent-list">{registrations.map((registration) => <div key={registration.registrationId}><span>{registration.registrationId}</span><strong>{registration.participant?.name}</strong><small>{registration.eventRegistrations?.map((event) => event.eventName).join(', ')}</small><Status value={registration.paymentStatus} /></div>)}</div>;
}

function EventBars({ events }) {
  const eventOrder = ['Ideathon', 'Cyber Heist CTF', 'IoT Exploit', 'Secure X VibeCode', 'Mind Cage', 'Mystery Hunt', 'Tune Trap', 'Auction Arena'];
  const sortedEvents = [...events].sort((a, b) => {
    const aIndex = eventOrder.indexOf(a.eventName);
    const bIndex = eventOrder.indexOf(b.eventName);
    return (aIndex === -1 ? eventOrder.length : aIndex) - (bIndex === -1 ? eventOrder.length : bIndex);
  });
  const max = Math.max(1, ...events.map((event) => event.registrations));
  return <div className="event-bars">{sortedEvents.map((event) => <div key={event.eventId}><span>{event.eventName}</span><div><i style={{ width: `${(event.registrations / max) * 100}%` }} /></div><strong>{event.registrations}</strong></div>)}</div>;
}

function Metric({ label, value, tone = 'blue' }) {
  return <article className={`metric-card metric-card--${tone}`}><span>{label}</span><strong>{value}</strong></article>;
}

function Status({ value }) {
  return <span className={`status-pill status-pill--${value}`}>{value}</span>;
}

function Skeleton() {
  return <div className="admin-skeleton">Loading operational data...</div>;
}
