import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Icon from '../components/Icon';
import './admin.css';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement | null, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export interface AdminUser {
  email: string;
  name?: string;
  tabs?: string[];
  picture?: string;
  active?: boolean;
  owner?: boolean;
}

export interface AdminSession {
  token: string;
  user: AdminUser;
}

export interface AdminOverview {
  total: number;
  statuses: {
    pending: number;
    confirmed: number;
    mismatch: number;
    duplicate: number;
  };
  confirmedRevenue: number;
  events: { eventId: string; eventName: string; registrations: number }[];
  recent: AdminRegistration[];
}

export interface AdminRegistration {
  registrationId: string;
  participant?: {
    name?: string;
    college?: string;
    email?: string;
    phone?: string;
  };
  eventRegistrations?: { eventName: string }[];
  paymentStatus: string;
  expectedAmount?: number;
  utrNumber?: string;
}

export interface PassField {
  label: string;
  value: string;
}

const apiBase = import.meta.env.VITE_API_URL || '';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const tabs = ['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export', 'Admin Access'];
const statuses = ['pending', 'confirmed', 'mismatch', 'duplicate'];

export default function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('noctivus-admin') || 'null');
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<string>('Dashboard');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [eventId, setEventId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${session?.token}` }),
    [session]
  );
  const isLoginRoute = window.location.pathname.startsWith('/login');
  const allowedTabs = session?.user?.tabs || [];
  const visibleTabs = tabs.filter((tab) => allowedTabs.includes(tab));
  const can = (tab: string) => allowedTabs.includes(tab);

  useEffect(() => {
    if (session && visibleTabs.length && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [session, visibleTabs, activeTab]);

  const logout = () => {
    sessionStorage.removeItem('noctivus-admin');
    setSession(null);
  };

  const refresh = async () => {
    setMessage('');
    const needsOverview = ['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export'].some(can);
    const needsRegistrations = ['Verify Members', 'Invitations', 'Export'].some(can);
    const [overviewResponse, registrationsResponse] = await Promise.all([
      needsOverview ? fetch(`${apiBase}/api/admin/overview`, { headers: authHeaders }) : Promise.resolve(null),
      needsRegistrations
        ? fetch(
            `${apiBase}/api/admin/registrations?${new URLSearchParams({
              ...(eventId && { eventId }),
              ...(status && { status }),
            })}`,
            { headers: authHeaders }
          )
        : Promise.resolve(null),
    ]);
    if (overviewResponse?.status === 401 || registrationsResponse?.status === 401) return logout();
    if (overviewResponse?.ok) setOverview(await overviewResponse.json());
    if (registrationsResponse?.ok) {
      const registrationsData = await registrationsResponse.json();
      setRegistrations(registrationsData.registrations || []);
    }
  };

  useEffect(() => {
    if (!session) return undefined;
    refresh();
  }, [session, eventId, status]);

  const saveSession = (data: AdminSession) => {
    sessionStorage.setItem('noctivus-admin', JSON.stringify(data));
    setSession(data);
  };

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
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <img src="/brand/noctivus-emblem.webp" alt="" /> <span>Noctivus Admin</span>
        </a>
        <nav>
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="admin-user">
          {session.user?.picture && <img src={session.user.picture} alt="" />}
          <span>{session.user?.name}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="kicker">ADMIN PANEL</span>
            <h1>{activeTab}</h1>
          </div>
          <button className="button button-secondary" onClick={refresh}>
            <Icon name="external" size={16} /> Refresh
          </button>
        </header>
        {message && <p className="admin-message">{message}</p>}
        {activeTab === 'Dashboard' && can('Dashboard') && <Dashboard overview={overview} />}
        {activeTab === 'Verify Members' && can('Verify Members') && (
          <Verify
            registrations={registrations}
            overview={overview}
            authHeaders={authHeaders}
            onChanged={refresh}
            eventId={eventId}
            setEventId={setEventId}
            status={status}
            setStatus={setStatus}
            selected={selected}
            setSelected={setSelected}
          />
        )}
        {activeTab === 'Invitations' && can('Invitations') && (
          <Invitations
            registrations={registrations}
            selected={selected}
            setSelected={setSelected}
            authHeaders={authHeaders}
            onSent={(count) => {
              setMessage(`${count} invitation emails queued.`);
              refresh();
            }}
          />
        )}
        {activeTab === 'AI Analysis' && can('AI Analysis') && (
          <Analysis overview={overview} authHeaders={authHeaders} />
        )}
        {activeTab === 'Export' && can('Export') && (
          <Export
            overview={overview}
            authHeaders={authHeaders}
            eventId={eventId}
            setEventId={setEventId}
            status={status}
            setStatus={setStatus}
          />
        )}
        {activeTab === 'Admin Access' && can('Admin Access') && (
          <AdminAccess authHeaders={authHeaders} onChanged={(text) => setMessage(text)} />
        )}
      </section>
    </main>
  );
}

function Login({ onSession }: { onSession: (session: AdminSession) => void }) {
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!googleClientId) return undefined;
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const script = (existing as HTMLScriptElement) || document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          try {
            const response = await fetch(`${apiBase}/api/admin/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Google sign-in failed.');
            onSession(data);
            window.location.replace('/admin');
          } catch (loginError: any) {
            setError(loginError.message);
          }
        },
      });
      window.google?.accounts.id.renderButton(document.getElementById('google-admin-login'), {
        theme: 'filled_black',
        size: 'large',
        width: 320,
      });
    };
    if (!existing) document.head.appendChild(script);
  }, [onSession]);

  return (
    <main className="admin-login">
      <section>
        <img src="/brand/noctivus-emblem.webp" alt="" />
        <span className="kicker">SECURE ADMIN ACCESS</span>
        <h1>Noctivus operations</h1>
        {googleClientId ? (
          <div id="google-admin-login" />
        ) : (
          <p className="form-error">
            Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to enable Google login.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}

function Dashboard({ overview }: { overview: AdminOverview | null }) {
  if (!overview) return <Skeleton />;
  return (
    <>
      <div className="admin-metrics">
        <Metric label="Registrations" value={overview.total} />
        <Metric label="Pending" value={overview.statuses.pending} />
        <Metric label="Confirmed" value={overview.statuses.confirmed} />
        <Metric label="Revenue" value={`Rs.${overview.confirmedRevenue}`} />
      </div>
      <div className="admin-grid">
        <section className="admin-panel">
          <h2>Event demand</h2>
          <EventBars events={overview.events} />
        </section>
        <section className="admin-panel">
          <h2>Recent registrations</h2>
          <RegistrationList registrations={overview.recent} />
        </section>
      </div>
    </>
  );
}

function Verify({
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
}: {
  registrations: AdminRegistration[];
  overview: AdminOverview | null;
  authHeaders: Record<string, string>;
  onChanged: () => void;
  eventId: string;
  setEventId: (val: string) => void;
  status: string;
  setStatus: (val: string) => void;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  const verify = async (registrationId: string, nextStatus: string) => {
    const response = await fetch(`${apiBase}/api/admin/registrations/${registrationId}/verify`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, notes: notes[registrationId] || '', sendEmail: true }),
    });
    if (response.ok) onChanged();
  };

  return (
    <>
      <Filters
        overview={overview}
        eventId={eventId}
        setEventId={setEventId}
        status={status}
        setStatus={setStatus}
      />
      <RegistrationTable
        registrations={registrations}
        selected={selected}
        setSelected={setSelected}
        renderActions={(registration) => (
          <div className="verify-actions">
            <input
              placeholder="Verification notes"
              value={notes[registration.registrationId] || ''}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [registration.registrationId]: event.target.value,
                }))
              }
            />
            <button onClick={() => verify(registration.registrationId, 'confirmed')}>Approve</button>
            <button onClick={() => verify(registration.registrationId, 'mismatch')}>Mismatch</button>
            <button onClick={() => verify(registration.registrationId, 'duplicate')}>Duplicate</button>
          </div>
        )}
      />
    </>
  );
}

function Invitations({
  registrations,
  selected,
  setSelected,
  authHeaders,
  onSent,
}: {
  registrations: AdminRegistration[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  authHeaders: Record<string, string>;
  onSent: (count: number) => void;
}) {
  const [title, setTitle] = useState<string>('Noctivus 26 Event Pass');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [fields, setFields] = useState<PassField[]>([
    { label: 'Reporting Time', value: '' },
    { label: 'Venue', value: 'Velammal Engineering College' },
  ]);
  const [imageError, setImageError] = useState<string>('');

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setImageError('');
    try {
      setImageDataUrl(await compressPassImage(file));
    } catch (error: any) {
      setImageError(error.message || 'Unable to compress this pass image.');
    }
  };

  const send = async () => {
    const response = await fetch(`${apiBase}/api/admin/invitations/send`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationIds: selected, pass: { title, imageDataUrl, fields } }),
    });
    const data = await response.json();
    if (response.ok) onSent(data.sent || 0);
  };

  return (
    <div className="admin-grid admin-grid--wide">
      <section className="admin-panel pass-builder">
        <h2>Pass builder</h2>
        <label className="field">
          <span>Pass title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>Pass image</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => uploadImage(event.target.files?.[0])}
          />
        </label>
        {imageError && <p className="form-error">{imageError}</p>}
        {fields.map((field, index) => (
          <div className="pass-field" key={index}>
            <input
              value={field.label}
              onChange={(event) =>
                setFields((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: event.target.value } : item
                  )
                )
              }
              placeholder="Title"
            />
            <input
              value={field.value}
              onChange={(event) =>
                setFields((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, value: event.target.value } : item
                  )
                )
              }
              placeholder="Value"
            />
          </div>
        ))}
        <button
          className="button button-secondary"
          onClick={() => setFields((current) => [...current, { label: '', value: '' }])}
        >
          Add title field
        </button>
        <button
          className="button button-primary"
          disabled={!selected.length}
          onClick={send}
        >
          Send {selected.length || ''} passes <Icon name="mail" />
        </button>
      </section>
      <section className="admin-panel">
        <h2>Confirmed members</h2>
        <RegistrationTable
          registrations={registrations.filter((item) => item.paymentStatus === 'confirmed')}
          selected={selected}
          setSelected={setSelected}
        />
      </section>
    </div>
  );
}

function Analysis({
  overview,
  authHeaders,
}: {
  overview: AdminOverview | null;
  authHeaders: Record<string, string>;
}) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const run = async () => {
    setLoading(true);
    const response = await fetch(`${apiBase}/api/admin/analysis/ai`, {
      method: 'POST',
      headers: authHeaders,
    });
    const data = await response.json();
    setAnalysis(typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2));
    setLoading(false);
  };
  return (
    <section className="admin-panel analysis-panel">
      <h2>Offline analysis</h2>
      <Dashboard overview={overview} />
      <button className="button button-primary" onClick={run} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze registrations offline'} <Icon name="shield" />
      </button>
      {analysis && <pre>{analysis}</pre>}
    </section>
  );
}

function Export({
  overview,
  authHeaders,
  eventId,
  setEventId,
  status,
  setStatus,
}: {
  overview: AdminOverview | null;
  authHeaders: Record<string, string>;
  eventId: string;
  setEventId: (val: string) => void;
  status: string;
  setStatus: (val: string) => void;
}) {
  const download = async () => {
    const response = await fetch(
      `${apiBase}/api/admin/export?${new URLSearchParams({
        ...(eventId && { eventId }),
        ...(status && { status }),
      })}`,
      { headers: authHeaders }
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `noctivus-${eventId || 'all'}-registrations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="admin-panel export-panel">
      <h2>Export member details</h2>
      <Filters
        overview={overview}
        eventId={eventId}
        setEventId={setEventId}
        status={status}
        setStatus={setStatus}
      />
      <button className="button button-primary" onClick={download}>
        Export CSV <Icon name="external" />
      </button>
    </section>
  );
}

function AdminAccess({
  authHeaders,
  onChanged,
}: {
  authHeaders: Record<string, string>;
  onChanged: (msg: string) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [form, setForm] = useState<{ email: string; name: string; tabs: string[] }>({
    email: '',
    name: '',
    tabs: ['Dashboard'],
  });
  const [loading, setLoading] = useState<boolean>(false);

  const load = async () => {
    const response = await fetch(`${apiBase}/api/admin/access`, { headers: authHeaders });
    const data = await response.json();
    if (response.ok) {
      setUsers(data.users || []);
      setAvailableTabs(data.tabs || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleTab = (tab: string) => {
    setForm((current) => ({
      ...current,
      tabs: current.tabs.includes(tab)
        ? current.tabs.filter((item) => item !== tab)
        : [...current.tabs, tab],
    }));
  };

  const edit = (user: AdminUser) => {
    setForm({
      email: user.email,
      name: user.name || '',
      tabs: user.tabs?.filter((tab) => tab !== 'Admin Access') || [],
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const response = await fetch(
      `${apiBase}/api/admin/access/${encodeURIComponent(form.email.trim().toLowerCase())}`,
      {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, tabs: form.tabs, active: true }),
      }
    );
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return onChanged(data.message || 'Unable to update access.');
    setForm({ email: '', name: '', tabs: ['Dashboard'] });
    await load();
    onChanged('Admin access updated.');
  };

  const deactivate = async (email: string) => {
    const response = await fetch(
      `${apiBase}/api/admin/access/${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: authHeaders }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onChanged(data.message || 'Unable to remove access.');
    await load();
    onChanged('Admin access removed.');
  };

  return (
    <div className="admin-grid admin-grid--wide">
      <form className="admin-panel access-form" onSubmit={save}>
        <h2>Give access</h2>
        <label className="field">
          <span>Google email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="user@gmail.com"
          />
        </label>
        <label className="field">
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Optional"
          />
        </label>
        <fieldset className="access-tabs">
          <legend>Allowed tabs</legend>
          {availableTabs.map((tab) => (
            <label key={tab}>
              <input
                type="checkbox"
                checked={form.tabs.includes(tab)}
                onChange={() => toggleTab(tab)}
              />
              <span>{tab}</span>
            </label>
          ))}
        </fieldset>
        <button
          className="button button-primary"
          type="submit"
          disabled={loading || !form.email || !form.tabs.length}
        >
          {loading ? 'Saving...' : 'Save access'} <Icon name="shield" />
        </button>
      </form>
      <section className="admin-panel access-list">
        <h2>Current admin users</h2>
        {users.map((user) => (
          <article key={user.email} className={!user.active ? 'inactive' : ''}>
            <div>
              <strong>{user.name || user.email}</strong>
              <small>{user.email}</small>
            </div>
            <div className="access-list__tabs">
              {user.tabs?.map((tab) => (
                <span key={tab}>{tab}</span>
              ))}
            </div>
            <div className="access-list__actions">
              {user.owner ? (
                <span className="status-pill status-pill--confirmed">Owner</span>
              ) : (
                <>
                  <button className="button button-secondary" onClick={() => edit(user)}>
                    Edit
                  </button>
                  <button className="button button-secondary" onClick={() => deactivate(user.email)}>
                    Remove
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function compressPassImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read pass image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Unable to load pass image.'));
      image.onload = () => {
        const maxWidth = 720;
        const maxHeight = 420;
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context?.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.68));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function Filters({
  overview,
  eventId,
  setEventId,
  status,
  setStatus,
}: {
  overview: AdminOverview | null;
  eventId: string;
  setEventId: (val: string) => void;
  status: string;
  setStatus: (val: string) => void;
}) {
  return (
    <div className="admin-filters">
      <label className="field">
        <span>Event</span>
        <select value={eventId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setEventId(event.target.value)}>
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
        <select value={status} onChange={(event: ChangeEvent<HTMLSelectElement>) => setStatus(event.target.value)}>
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

function RegistrationTable({
  registrations,
  selected,
  setSelected,
  renderActions,
}: {
  registrations: AdminRegistration[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  renderActions?: (registration: AdminRegistration) => React.ReactNode;
}) {
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  return (
    <div className="registration-table">
      {registrations.map((registration) => (
        <article key={registration.registrationId}>
          <label>
            <input
              type="checkbox"
              checked={selected.includes(registration.registrationId)}
              onChange={() => toggle(registration.registrationId)}
            />
            <span>{registration.registrationId}</span>
          </label>
          <div>
            <strong>{registration.participant?.name}</strong>
            <small>{registration.participant?.college}</small>
          </div>
          <div>
            <strong>
              {registration.eventRegistrations?.map((event) => event.eventName).join(', ')}
            </strong>
            <small>{registration.participant?.email}</small>
          </div>
          <Status value={registration.paymentStatus} />
          <div>
            <strong>Rs.{registration.expectedAmount}</strong>
            <small>UTR {registration.utrNumber}</small>
          </div>
          {renderActions?.(registration)}
        </article>
      ))}
    </div>
  );
}

function RegistrationList({ registrations }: { registrations: AdminRegistration[] }) {
  return (
    <div className="recent-list">
      {registrations.map((registration) => (
        <div key={registration.registrationId}>
          <span>{registration.registrationId}</span>
          <strong>{registration.participant?.name}</strong>
          <small>
            {registration.eventRegistrations?.map((event) => event.eventName).join(', ')}
          </small>
          <Status value={registration.paymentStatus} />
        </div>
      ))}
    </div>
  );
}

function EventBars({ events }: { events: { eventId: string; eventName: string; registrations: number }[] }) {
  const max = Math.max(1, ...events.map((event) => event.registrations));
  return (
    <div className="event-bars">
      {events.map((event) => (
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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Status({ value }: { value: string }) {
  return <span className={`status-pill status-pill--${value}`}>{value}</span>;
}

function Skeleton() {
  return <div className="admin-skeleton">Loading operational data...</div>;
}
