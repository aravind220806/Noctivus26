import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../dashboard-layout';
import { apiUrl } from '../lib/api';
import { adminFetch, setGlobalCsrf, tabs } from './adminUtils';
import { AdminAccessTab } from './components/AdminAccessTab';
import { AdminLogin } from './components/AdminLogin';
import { AnalysisTab } from './components/AnalysisTab';
import { AnnouncementsTab } from './components/AnnouncementsTab';
import { AuditLogTab } from './components/AuditLogTab';
import { CheckInTab } from './components/CheckInTab';
import { DashboardTab } from './components/DashboardTab';
import { EventSchedulerTab } from './components/EventSchedulerTab';
import { EventsTab } from './components/EventsTab';
import { ExportTab } from './components/ExportTab';
import { InvitationsTab } from './components/InvitationsTab';
import { VerifyTab } from './components/VerifyTab';
import './admin.css';

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [overview, setOverview] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  const authHeaders = useMemo(
    () => (csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    [csrfToken],
  );
  const isLoginRoute = window.location.pathname.startsWith('/login');
  const allowedTabs = session?.user?.tabs;
  const visibleTabs = useMemo(() => tabs.filter((tab) => (allowedTabs || []).includes(tab)), [allowedTabs]);
  const can = (tab) => (allowedTabs || []).includes(tab);

  useEffect(() => {
    let active = true;
    adminFetch(apiUrl('/api/admin/me'))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setSession({ user: data.user });
          const token = data.csrfToken || data.user?.csrf || '';
          if (token) {
            setCsrfToken(token);
            setGlobalCsrf(token); // populate global store immediately
          }
        }
        setAuthChecked(true);
      })
      .catch(() => active && setAuthChecked(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (session && visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
  }, [session, visibleTabs, activeTab]);

  useEffect(() => {
    if (!session) return undefined;
    refresh();
  }, [session, eventId, status]);

  // Background Auto-Refresh interval (every 15 seconds)
  useEffect(() => {
    if (!session || !autoRefresh) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [session, autoRefresh, eventId, status, authHeaders]);

  const saveSession = (data) => {
    setSession(data);
    const token = data?.csrfToken || data?.user?.csrf || '';
    if (token) {
      setCsrfToken(token);
      setGlobalCsrf(token); // populate global store so all tabs get it immediately
    }
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

  const refresh = async (silent = false) => {
    if (!silent) setMessage('');
    setIsRefreshing(true);
    try {
      const needsOverview = ['Dashboard', 'Verify Members', 'Invitations', 'AI Analysis', 'Export'].some(can);
      const needsRegistrations = ['Verify Members', 'Invitations', 'Export'].some(can);
      const [overviewResponse, registrationsResponse] = await Promise.all([
        needsOverview ? adminFetch(apiUrl('/api/admin/overview'), { headers: authHeaders }) : Promise.resolve(null),
        needsRegistrations
          ? adminFetch(
              apiUrl(
                `/api/admin/registrations?${new URLSearchParams({ ...(eventId && { eventId }), ...(status && { status }) })}`
              ),
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
      setLastRefreshedAt(new Date());
    } catch (error) {
      if (!silent) {
        const detail =
          error instanceof Error
            ? error.message
            : 'Unable to load admin data. Check the API connection and try again.';
        setMessage(detail);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!authChecked) return <div className="admin-loading">Checking admin session...</div>;

  if (!session && !isLoginRoute) {
    window.location.replace('/login');
    return <div className="admin-loading">Redirecting to login...</div>;
  }

  if (!session) return <AdminLogin onSession={saveSession} />;

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
      onTabChange={(tab) => {
        setActiveTab(tab);
        setSidebarOpen(false);
      }}
      onRefresh={() => refresh(false)}
      onLogout={logout}
      onMenuToggle={() => setSidebarOpen((open) => !open)}
      autoRefresh={autoRefresh}
      onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
      isRefreshing={isRefreshing}
      lastRefreshedAt={lastRefreshedAt}
    >
      {message && <p className="admin-message">{message}</p>}
      {activeTab === 'Dashboard' && can('Dashboard') && (
        <DashboardTab overview={overview} onRefresh={refresh} authHeaders={authHeaders} />
      )}
      {activeTab === 'Verify Members' && can('Verify Members') && (
        <VerifyTab
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
      {activeTab === 'Check-in' && can('Check-in') && <CheckInTab authHeaders={authHeaders} />}
      {activeTab === 'Events' && can('Events') && <EventsTab authHeaders={authHeaders} onEventChanged={refresh} />}
      {activeTab === 'Event Scheduler' && can('Event Scheduler') && <EventSchedulerTab authHeaders={authHeaders} />}
      {activeTab === 'Audit Log' && can('Audit Log') && <AuditLogTab authHeaders={authHeaders} />}
      {activeTab === 'Invitations' && can('Invitations') && (
        <InvitationsTab
          overview={overview}
          authHeaders={authHeaders}
          onSent={(count) => {
            setMessage(`${count} invitation emails queued.`);
            refresh();
          }}
        />
      )}
      {activeTab === 'Announcements' && can('Announcements') && <AnnouncementsTab authHeaders={authHeaders} />}
      {activeTab === 'AI Analysis' && can('AI Analysis') && <AnalysisTab overview={overview} authHeaders={authHeaders} />}
      {activeTab === 'Export' && can('Export') && (
        <ExportTab
          overview={overview}
          authHeaders={authHeaders}
          eventId={eventId}
          setEventId={setEventId}
          status={status}
          setStatus={setStatus}
        />
      )}
      {activeTab === 'Admin Access' && can('Admin Access') && (
        <AdminAccessTab authHeaders={authHeaders} onChanged={(text) => setMessage(text)} />
      )}
    </DashboardLayout>
  );
}
