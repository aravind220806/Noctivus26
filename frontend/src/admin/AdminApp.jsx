import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import DashboardLayout from '../dashboard-layout';
import { DashboardContent } from '../components/bionis/dashboard-content';
import './admin.css';

const apiBase = import.meta.env.VITE_API_URL || '';
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
    adminFetch(`${apiBase}/api/admin/me`)
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
      await adminFetch(`${apiBase}/api/admin/logout`, { method: 'POST' });
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
        needsOverview ? adminFetch(`${apiBase}/api/admin/overview`, { headers: authHeaders }) : Promise.resolve(null),
        needsRegistrations ? adminFetch(`${apiBase}/api/admin/registrations?${new URLSearchParams({ ...(eventId && { eventId }), ...(status && { status }) })}`, { headers: authHeaders }) : Promise.resolve(null),
      ]);
      if (overviewResponse?.status === 401 || registrationsResponse?.status === 401) return logout();
      if (overviewResponse?.ok) setOverview(await overviewResponse.json());
      if (registrationsResponse?.ok) {
        const registrationsData = await registrationsResponse.json();
        setRegistrations(registrationsData.registrations || []);
      }
    } catch {
      setMessage('Unable to load admin data. Check the API connection and try again.');
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
        {activeTab === 'Dashboard' && can('Dashboard') && <Dashboard overview={overview} />}
        {activeTab === 'Verify Members' && can('Verify Members') && <Verify registrations={registrations} overview={overview} authHeaders={authHeaders} onChanged={refresh} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} selected={selected} setSelected={setSelected} />}
        {activeTab === 'Check-in' && can('Check-in') && <CheckIn authHeaders={authHeaders} />}
        {activeTab === 'Events' && can('Events') && <EventsTab authHeaders={authHeaders} />}
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

function EventsTab({ authHeaders }) {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');
  const load = async () => {
    const response = await adminFetch(`${apiBase}/api/admin/events`, { headers: authHeaders });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setItems(data.events || []);
      setDrafts(Object.fromEntries((data.events || []).map((event) => [event.id, { date: event.date || '', time: event.time || '', gate: event.gate || '', venue: event.venue || '', terminal: event.terminal || 'MAIN HALL', seatType: event.seatType || 'VIP', passActive: event.passActive !== false }])));
    }
    else setMessage(data.detail || data.message || 'Unable to load events.');
  };
  useEffect(() => { load(); }, []);
  const save = async (event, changes) => {
    const response = await adminFetch(`${apiBase}/api/admin/events/${event.id}`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.detail || data.message || 'Unable to update event.');
    setMessage(`${event.name} updated.`);
    load();
  };
  const changeDraft = (id, key, value) => setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  return <section className="admin-panel events-admin-panel"><h2>Event lifecycle & pass details</h2><p className="admin-help">Set these fields once per event. Boarding passes pull them automatically and cannot be sent until event pass details are complete.</p>{message && <p className="admin-message">{message}</p>}<div className="admin-event-list">{items.map((event) => <article className="event-lifecycle-card" key={event.id}><div><strong>{event.name}</strong><small>{event.category} · {event.registrationCount || 0} registrations</small></div><span className={`status-pill status-pill--${event.effectiveStatus || event.status}`}>{event.effectiveStatus || event.status}</span><button className="button button-secondary" onClick={() => save(event, { status: event.status === 'open' ? 'closed' : 'open' })}>{event.status === 'open' ? 'Close' : 'Open'}</button><div className="event-pass-fields"><label className="field"><span>Date</span><input value={drafts[event.id]?.date || ''} onChange={(e) => changeDraft(event.id, 'date', e.target.value)} placeholder="26 Sep 2026" /></label><label className="field"><span>Time</span><input value={drafts[event.id]?.time || ''} onChange={(e) => changeDraft(event.id, 'time', e.target.value)} placeholder="09:00 AM" /></label><label className="field"><span>Gate</span><input value={drafts[event.id]?.gate || ''} onChange={(e) => changeDraft(event.id, 'gate', e.target.value)} placeholder="VEC Gate 1" /></label><label className="field"><span>Venue</span><input value={drafts[event.id]?.venue || ''} onChange={(e) => changeDraft(event.id, 'venue', e.target.value)} placeholder="CSE Lab 1" /></label><label className="field"><span>Terminal / Hall</span><input value={drafts[event.id]?.terminal || ''} onChange={(e) => changeDraft(event.id, 'terminal', e.target.value)} placeholder="MAIN HALL" /></label><label className="field"><span>Seat Type</span><input value={drafts[event.id]?.seatType || ''} onChange={(e) => changeDraft(event.id, 'seatType', e.target.value)} placeholder="VIP" /></label><label className="field field-checkbox"><input type="checkbox" checked={drafts[event.id]?.passActive !== false} onChange={(e) => changeDraft(event.id, 'passActive', e.target.checked)} /> <span>Pass active</span></label><button className="button button-primary" onClick={() => save(event, drafts[event.id])}>Save pass details</button></div></article>)}</div></section>;
}

function CheckIn({ authHeaders }) {
  const [registrationId, setRegistrationId] = useState('');
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState({ confirmed: 0, checkedIn: 0 });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [walkIn, setWalkIn] = useState({ name: '', college: '', eventId: '' });
  const scannerRef = useRef(null);
  const load = async () => {
    const response = await adminFetch(`${apiBase}/api/admin/check-in/summary`, { headers: authHeaders });
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
        setRegistrationId(value.trim());
        setCameraOpen(false);
      }, () => {}).catch((error) => setResult({ ok: false, message: error?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access, then try again.' : 'Camera could not start. Use HTTPS or localhost and enter the registration ID manually.' }));
    }).catch(() => setResult({ ok: false, message: 'QR scanner could not load. Enter the registration ID manually.' }));
    return () => { active = false; const scanner = scannerRef.current; scannerRef.current = null; if (scanner) scanner.stop().catch(() => {}).finally(() => scanner.clear().catch(() => {})); };
  }, [cameraOpen]);
  const scan = async (event) => {
    event.preventDefault();
    const response = await adminFetch(`${apiBase}/api/admin/check-in/${encodeURIComponent(registrationId.trim())}`, { method: 'POST', headers: authHeaders });
    const data = await response.json().catch(() => ({}));
    setResult({ ok: response.ok, status: data.status, message: data.detail || data.message || data.status });
    setRegistrationId('');
    if (response.ok && data.status === 'checked-in') load();
  };
  const createWalkIn = async (event) => { event.preventDefault(); const response = await adminFetch(`${apiBase}/api/admin/walk-ins`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ participant: { name: walkIn.name, college: walkIn.college }, eventId: walkIn.eventId }) }); const data = await response.json().catch(() => ({})); setResult({ ok: response.ok, message: response.ok ? `Walk-in created: ${data.registration?.registrationId}` : data.detail || data.message || 'Unable to create walk-in.' }); if (response.ok) setWalkIn({ name: '', college: '', eventId: '' }); };
  return <section className="admin-panel check-in-panel"><h2>Check-in desk</h2><p>Scan the registration QR or enter the registration ID printed on the participant receipt.</p>{cameraOpen && <div id="admin-qr-reader" className="check-in-camera" aria-label="QR scanner camera" />}<div className="check-in-actions"><button className="button button-secondary" type="button" onClick={() => setCameraOpen((open) => !open)}>{cameraOpen ? 'Close camera' : 'Open camera'}</button><small>Camera QR scanning loads only when opened</small></div><form onSubmit={scan} className="admin-form"><input value={registrationId} onChange={(event) => setRegistrationId(event.target.value)} placeholder="NOC26-XXXXXX" autoFocus /><button className="button button-primary" disabled={!registrationId.trim()}>Check in</button></form>{result && <p className={`admin-message ${result.ok ? 'admin-message--success' : ''}`}>{result.message}</p>}<div className="admin-metrics"><article><span>Checked in</span><strong>{summary.checkedIn}</strong></article><article><span>Confirmed</span><strong>{summary.confirmed}</strong></article></div><details className="walk-in-form"><summary>Manual walk-in registration</summary><form onSubmit={createWalkIn} className="admin-form"><input required value={walkIn.name} onChange={(event) => setWalkIn({ ...walkIn, name: event.target.value })} placeholder="Participant name" /><input required value={walkIn.college} onChange={(event) => setWalkIn({ ...walkIn, college: event.target.value })} placeholder="College" /><input required value={walkIn.eventId} onChange={(event) => setWalkIn({ ...walkIn, eventId: event.target.value })} placeholder="Event ID e.g. ideathon" /><button className="button button-primary">Create walk-in</button></form></details></section>;
}

function AuditLog({ authHeaders }) {
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState([]);
  const load = async () => {
    const response = await adminFetch(`${apiBase}/api/admin/audit-log?${new URLSearchParams({ search })}`, { headers: authHeaders });
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
    const response = await adminFetch(`${apiBase}/api/admin/announcements/send`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
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
              const response = await adminFetch(`${apiBase}/api/admin/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
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

  return (
    <main className="admin-login">
      <section>
        <img src="/brand/noctivus-emblem.webp" alt="" />
        <span className="kicker">SECURE ADMIN ACCESS</span>
        <h1>Noctivus operations</h1>
        <a className="admin-login__home" href="/">Back to home</a>
        {googleClientId ? <div id="google-admin-login" aria-busy={loading} /> : <p className="form-error" role="alert">Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to enable Google login.</p>}
        {loading && !buttonReady && <p className="admin-login__status">Connecting to Google sign-in…</p>}
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}

function Dashboard({ overview }) {
  if (!overview) return <Skeleton />;
  return <DashboardContent overview={overview} />;
}

function Verify({ registrations, overview, authHeaders, onChanged, eventId, setEventId, status, setStatus, selected, setSelected }) {
  const [notes, setNotes] = useState({});
  const [search, setSearch] = useState('');

  const verify = async (registrationId, nextStatus) => {
    const response = await adminFetch(`${apiBase}/api/admin/registrations/${registrationId}/verify`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, notes: notes[registrationId] || '', sendEmail: true }),
    });
    if (response.ok) onChanged();
  };

  return (
    <>
      <div className="admin-filters"><label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, UTR" /></label><Filters overview={overview} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} /></div>
      <div className="verify-bulk-actions"><button className="button button-secondary" disabled={!selected.length} onClick={async () => { await bulkVerify(authHeaders, selected, 'confirmed'); setSelected([]); onChanged(); }}>Confirm selected</button><button className="button button-secondary" disabled={!selected.length} onClick={async () => { await bulkVerify(authHeaders, selected, 'mismatch'); setSelected([]); onChanged(); }}>Reject selected</button></div>
      <RegistrationTable registrations={registrations.filter((item) => { const term = search.toLowerCase(); return !term || `${item.participant?.name} ${item.participant?.email} ${item.participant?.phone} ${item.utrNumber}`.toLowerCase().includes(term); })} selected={selected} setSelected={setSelected} renderActions={(registration) => (
        <div className="verify-actions">
          <input placeholder="Verification notes" value={notes[registration.registrationId] || ''} onChange={(event) => setNotes((current) => ({ ...current, [registration.registrationId]: event.target.value }))} />
          <button onClick={() => verify(registration.registrationId, 'confirmed')}>Approve</button>
          <button onClick={() => verify(registration.registrationId, 'mismatch')}>Mismatch</button>
          <button onClick={() => verify(registration.registrationId, 'duplicate')}>Duplicate</button>
        </div>
      )} />
    </>
  );
}

async function bulkVerify(authHeaders, registrationIds, status) {
  await adminFetch(`${apiBase}/api/admin/registrations/bulk-verify`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationIds, status }) });
}

function Invitations({ overview, authHeaders, onSent }) {
  const [eventId, setEventId] = useState('');
  const [eventRecords, setEventRecords] = useState([]);
  const [confirmedRegistrations, setConfirmedRegistrations] = useState([]);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState([]);
  const [selectedRegistrantId, setSelectedRegistrantId] = useState('');
  const [passPreviewUrl, setPassPreviewUrl] = useState('');
  const [previewMessage, setPreviewMessage] = useState('Select an event to preview a pass.');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const selectedEvent = eventRecords.find((event) => event.id === eventId) || overview?.events?.find((event) => event.eventId === eventId);
  const venue = selectedEvent?.venue || '';
  const gate = selectedEvent?.gate || '';
  const date = selectedEvent?.date || '';
  const time = selectedEvent?.time || '';
  const terminal = selectedEvent?.terminal || 'Main Hall';

  useEffect(() => {
    adminFetch(`${apiBase}/api/admin/events`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setEventRecords(data.events || []))
      .catch(() => {});
  }, [authHeaders]);

  useEffect(() => {
    if (!eventId) {
      setConfirmedRegistrations([]);
      setSelectedRegistrantId('');
      return undefined;
    }
    let active = true;
    adminFetch(`${apiBase}/api/admin/registrations?${new URLSearchParams({ eventId, status: 'confirmed' })}`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const list = data.registrations || [];
        setConfirmedRegistrations(list);
        if (list.length > 0) {
          setSelectedRegistrantId(list[0].registrationId);
          setSelectedRegistrationIds(list.map((row) => row.registrationId));
        } else {
          setSelectedRegistrantId('');
          setSelectedRegistrationIds([]);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [eventId, authHeaders]);

  const activeRegistrant = useMemo(() => {
    return confirmedRegistrations.find((r) => r.registrationId === selectedRegistrantId) || confirmedRegistrations[0] || null;
  }, [confirmedRegistrations, selectedRegistrantId]);

  const displayPassenger = activeRegistrant?.participant?.name || 'selected member';

  useEffect(() => {
    if (!eventId) {
      setPassPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; });
      setPreviewMessage('Select an event to preview a pass.');
      return undefined;
    }
    if (selectedEvent?.passActive === false) {
      setPassPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; });
      setPreviewMessage('Pass generation is disabled for this event.');
      return undefined;
    }
    if (![venue, date, time, gate, terminal].every((value) => value.trim())) {
      setPassPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; });
      setPreviewMessage('Event details incomplete - set date/time/gate/venue/terminal in the Events tab.');
      return undefined;
    }
    const controller = new AbortController();
    setPreviewMessage('Generating boarding pass...');
    adminFetch(`${apiBase}/api/admin/invitations/preview`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, registrationId: activeRegistrant?.registrationId || '' }),
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
  }, [eventId, activeRegistrant?.registrationId, venue, date, time, gate, terminal, selectedEvent?.passActive, authHeaders]);

  const send = async () => {
    if (!eventId) {
      setError('Please select an event.');
      return;
    }
    if (selectedEvent?.passActive === false) {
      setError('Pass generation is disabled for this event.');
      return;
    }
    if (![venue, date, time, gate, terminal].every((value) => value.trim())) {
      setError('This event is missing pass details. Fill date, time, gate, venue, and terminal on the Events tab first.');
      return;
    }
    setError('');
    setSending(true);
    try {
      const response = await adminFetch(`${apiBase}/api/admin/invitations/send`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, audience: 'confirmed', registrationIds: selectedRegistrationIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) onSent(data.sent || 0);
      else setError(data.detail || data.message || 'Unable to queue passes.');
    } catch (sendError) {
      setError(sendError.message || 'Unable to reach the invitation service. Check the API connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-grid admin-grid--wide invitation-automation">
      <section className="admin-panel pass-builder">
        <h2>Send Boarding Passes</h2>
        <p className="admin-help">Choose confirmed members and preview their pass. Date, time, gate, and venue are locked to the event details set on the Events tab.</p>
        <label className="field"><span>Event</span><select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">Choose an event</option>{eventRecords.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
        {eventId && <div className="pass-event-details"><strong>{selectedEvent?.name}</strong><span>{date || 'Date missing'} · {time || 'Time missing'}</span><span>{gate || 'Gate missing'} · {venue || 'Venue missing'} · {terminal || 'Terminal missing'}</span></div>}

        {confirmedRegistrations.length > 0 && (
          <label className="field"><span>Preview Registrant</span><select value={selectedRegistrantId} onChange={(event) => setSelectedRegistrantId(event.target.value)}>{confirmedRegistrations.map((r) => <option key={r.registrationId} value={r.registrationId}>{r.participant?.name} ({r.registrationId})</option>)}</select></label>
        )}

        {confirmedRegistrations.length > 0 && <div className="invitation-members"><div><strong>Recipients</strong><button type="button" onClick={() => setSelectedRegistrationIds(selectedRegistrationIds.length === confirmedRegistrations.length ? [] : confirmedRegistrations.map((row) => row.registrationId))}>{selectedRegistrationIds.length === confirmedRegistrations.length ? 'Clear all' : 'Select all'}</button></div>{confirmedRegistrations.map((row) => <label key={row.registrationId}><input type="checkbox" checked={selectedRegistrationIds.includes(row.registrationId)} onChange={() => setSelectedRegistrationIds((current) => current.includes(row.registrationId) ? current.filter((id) => id !== row.registrationId) : [...current, row.registrationId])} /> <span>{row.participant?.name} <small>{row.registrationId}</small></span></label>)}</div>}
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary" disabled={!eventId || selectedEvent?.passActive === false || ![venue, date, time, gate, terminal].every((value) => value.trim()) || !selectedRegistrationIds.length || sending} onClick={send}>{sending ? 'Queueing passes...' : `Generate & send ${selectedRegistrationIds.length} pass${selectedRegistrationIds.length === 1 ? '' : 'es'}`} <Icon name="mail" /></button>
      </section>

      <section className="admin-panel pass-sample">
        <div className="boarding-pass-card">
          {passPreviewUrl && <img className="boarding-pass-render" src={passPreviewUrl} alt={`Generated boarding pass for ${displayPassenger}`} />}
          {!passPreviewUrl && <div className="boarding-pass-empty">{previewMessage}</div>}
        </div>
      </section>
    </div>
  );
}

function EventSchedulerTab({ authHeaders }) {
  const [form, setForm] = useState({ morning: { time: '09:00 AM', memberCount: '' }, afternoon: { time: '02:00 PM', memberCount: '' } });
  const [summary, setSummary] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await adminFetch(`${apiBase}/api/admin/scheduler`, { headers: authHeaders });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.schedule) setForm(data.schedule);
    else setMessage(data.detail || data.message || 'Unable to load scheduler settings.');
  };

  useEffect(() => { load(); }, []);

  const updateSlot = (slot, key, value) => setForm((current) => ({ ...current, [slot]: { ...current[slot], [key]: value } }));

  const assign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setAnalysis('');
    try {
      const saveResponse = await adminFetch(`${apiBase}/api/admin/scheduler`, { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const saveData = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(saveData.detail || saveData.message || 'Unable to save scheduler settings.');
      const response = await adminFetch(`${apiBase}/api/admin/scheduler/assign`, { method: 'POST', headers: authHeaders });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.message || 'Unable to assign event batches.');
      setForm(data.schedule);
      setSummary(data.summary);
      setAnalysis(data.analysis || '');
      setMessage('Confirmed members were assigned to event batches.');
    } catch (error) {
      setMessage(error.message || 'Unable to run event automation.');
    } finally {
      setSaving(false);
    }
  };

  return <form className="admin-panel scheduler-panel" onSubmit={assign}><h2>Event Scheduler</h2><p className="admin-help">Set the morning and afternoon times. Confirmed member counts are calculated automatically for every event. Enter an optional count only when you need to override the automatic split.</p><div className="scheduler-lanes">{[['morning', 'Morning batch'], ['afternoon', 'Afternoon batch']].map(([slot, label]) => <section className="scheduler-lane" key={slot}><h3>{label}</h3><label className="field"><span>Event time</span><input required value={form[slot].time} onChange={(event) => updateSlot(slot, 'time', event.target.value)} placeholder={slot === 'morning' ? '09:00 AM' : '02:00 PM'} /></label><label className="field"><span>Manual member count (optional)</span><input type="number" min="1" max="10000" value={form[slot].memberCount || ''} onChange={(event) => updateSlot(slot, 'memberCount', event.target.value)} placeholder="Automatic" /></label></section>)}</div>{message && <p className="admin-message">{message}</p>}<button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Assigning batches...' : 'Save & automate schedule'} <Icon name="arrow" /></button>{summary && <div className="scheduler-results"><h3>Every event</h3>{summary.events.map((event) => <div key={event.eventId}><strong>{event.eventName} · {event.members} members total</strong><small>Morning: {event.morning} · {event.morningTime} | Afternoon: {event.afternoon} · {event.afternoonTime}</small></div>)}</div>}{analysis && <pre className="scheduler-analysis">{analysis}</pre>}</form>;
}

function Analysis({ overview, authHeaders }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const response = await adminFetch(`${apiBase}/api/admin/analysis/ai`, { method: 'POST', headers: authHeaders });
    const data = await response.json();
    setAnalysis(typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2));
    setLoading(false);
  };
  return <section className="admin-panel analysis-panel"><h2>Offline analysis</h2><Dashboard overview={overview} /><button className="button button-primary" onClick={run} disabled={loading}>{loading ? 'Analyzing...' : 'Analyze registrations offline'} <Icon name="shield" /></button>{analysis && <pre>{analysis}</pre>}</section>;
}

function Export({ overview, authHeaders, eventId, setEventId, status, setStatus }) {
  const download = async () => {
    const response = await adminFetch(`${apiBase}/api/admin/export?${new URLSearchParams({ ...(eventId && { eventId }), ...(status && { status }) })}`, { headers: authHeaders });
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
    const response = await adminFetch(`${apiBase}/api/admin/access`, { headers: authHeaders });
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
    const response = await adminFetch(`${apiBase}/api/admin/access/${encodeURIComponent(form.email.trim().toLowerCase())}`, {
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
    const response = await adminFetch(`${apiBase}/api/admin/access/${encodeURIComponent(email)}`, { method: 'DELETE', headers: authHeaders });
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
