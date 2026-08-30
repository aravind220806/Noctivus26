import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardTitle } from './shared';

type Overview = {
  total: number;
  confirmedRevenue: number;
  statuses: { pending: number; confirmed: number };
  events: Array<{ eventId: string; eventName: string; registrations: number }>;
  recent: Array<{ registrationId: string; participant?: { name?: string; email?: string }; eventRegistrations?: Array<{ eventName: string }>; createdAt?: string; paymentStatus?: string }>;
  storage?: { available?: boolean; limitBytes?: number; storageBytes?: number; dataBytes?: number; indexBytes?: number };
};

const eventOrder = ['Ideathon', 'Cyber Heist CTF', 'IoT Exploit', 'Secure X VibeCode', 'Mind Cage', 'Mystery Hunt', 'Tune Trap', 'Auction Arena'];

export function DashboardContent({ overview }: { overview: Overview }) {
  const usedBytes = overview.storage?.storageBytes || overview.storage?.dataBytes || 0;
  const usage = overview.storage?.available && overview.storage.limitBytes ? Math.min(100, Math.round((usedBytes / overview.storage.limitBytes) * 100)) : null;
  const eventData = [...overview.events].sort((a, b) => eventOrder.indexOf(a.eventName) - eventOrder.indexOf(b.eventName));
  const recentData = overview.recent.map((registration, index) => ({
    name: registration.createdAt ? new Date(registration.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `R${index + 1}`,
    registrations: index + 1,
  }));

  return (
    <>
      <section className="bionis-overview">
        <Card className="bionis-score-card">
          <span className="bionis-section-label">Registrations Overview</span>
          <div className="bionis-score"><strong>{overview.total}</strong><span>Total registrations</span></div>
        </Card>
        <div className="admin-metrics">
          <MetricCard label="REGISTRATIONS" value={overview.total} tone="blue" />
          <MetricCard label="PENDING" value={overview.statuses.pending} tone="orange" />
          <MetricCard label="CONFIRMED" value={overview.statuses.confirmed} tone="green" />
          <MetricCard label="REVENUE" value={`Rs.${overview.confirmedRevenue}`} tone="purple" />
        </div>
      </section>
      <div className="admin-grid bionis-dashboard-grid">
        <Card className="bionis-event-demand">
          <CardTitle>Event demand</CardTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={eventData} layout="vertical" margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
              <CartesianGrid horizontal={false} stroke="#E5E7EB" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="eventName" width={140} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#F3F4F6' }} />
              <Bar dataKey="registrations" fill="#000000" radius={[0, 8, 8, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <CardTitle>Recent registrations</CardTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={recentData}>
              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip cursor={{ fill: '#F3F4F6' }} />
              <Bar dataKey="registrations" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="recent-list">{overview.recent.map((registration) => <div key={registration.registrationId}><span>{registration.registrationId}</span><strong>{registration.participant?.name}</strong><small>{registration.eventRegistrations?.map((event) => event.eventName).join(', ')}</small><span className={`status-pill status-pill--${registration.paymentStatus}`}>{registration.paymentStatus}</span></div>)}</div>
        </Card>
      </div>
      <Card className="storage-monitor">
        <div className="storage-monitor__heading"><div><span className="kicker">DATABASE STORAGE</span><h2>MongoDB capacity</h2></div><strong>{usage === null ? 'Unavailable' : `${usage}% used`}</strong></div>
        {usage === null ? <p>Storage metrics are unavailable for this database role. Registration and email data remain operational.</p> : <><div className={`storage-meter ${usage >= 85 ? 'storage-meter--warning' : ''}`}><i style={{ width: `${usage}%` }} /></div><div className="storage-monitor__values"><span>{formatBytes(usedBytes)} used</span><span>{formatBytes(overview.storage?.limitBytes || 0)} limit</span><span>{formatBytes(overview.storage?.indexBytes || 0)} indexes</span></div></>}
      </Card>
    </>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <article className={`metric-card metric-card--${tone}`}><span>{label}</span><strong>{value}</strong></article>;
}

function formatBytes(value: number) {
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(0, Math.round(value / 1024))} KB`;
}
