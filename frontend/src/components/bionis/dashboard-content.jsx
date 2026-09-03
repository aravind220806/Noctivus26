import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardTitle } from './shared';

const eventOrder = ['Ideathon', 'Cyber Heist CTF', 'IoT Exploit', 'Secure X VibeCode', 'Mind Cage', 'Mystery Hunt', 'Tune Trap', 'Auction Arena'];

export function DashboardContent({
  overview,
  onToggleEventStatus,
}) {
  const usedBytes = overview.storage?.storageBytes || overview.storage?.dataBytes || 0;
  const usage = overview.storage?.available && overview.storage.limitBytes ? Math.min(100, Math.round((usedBytes / overview.storage.limitBytes) * 100)) : null;
  const eventData = [...(overview.events || [])].sort((a, b) => eventOrder.indexOf(a.eventName) - eventOrder.indexOf(b.eventName));
  const hasRegistrations = eventData.some((e) => (e.registrations || 0) > 0);
  const chartHeight = eventData.length * 36; // ~288px for 8 rows
  const recentList = overview.recent || [];

  return (
    <div className="dashboard-content-wrapper">
      {/* Top Stat Cards */}
      <section className="admin-metrics">
        <MetricCard label="TOTAL REGISTRATIONS" value={overview.total ?? 0} subtext="Registered attendees" tone="blue" />
        <MetricCard label="PENDING VERIFICATION" value={overview.statuses?.pending ?? 0} subtext="Awaiting admin approval" tone="orange" />
        <MetricCard label="CONFIRMED PAYMENTS" value={overview.statuses?.confirmed ?? 0} subtext="Verified & confirmed" tone="green" />
        <MetricCard label="TOTAL REVENUE" value={`Rs.${overview.confirmedRevenue ?? 0}`} subtext="Collected fees" tone="purple" />
      </section>

      {/* Events Control Panel */}
      <Card className="dashboard-events-card">
        <div className="dashboard-card-header">
          <div>
            <CardTitle>Events Control &amp; Venues</CardTitle>
            <p className="admin-help" style={{ margin: '4px 0 0' }}>Manage event status, active venues, and registration availability.</p>
          </div>
          <span className="dashboard-event-count">{overview.events?.length || 0} Events Configured</span>
        </div>
        <div className="dashboard-events-grid">
          {eventData.map((event) => {
            const currentStatus = event.effectiveStatus || event.status || 'open';
            const isOpen = currentStatus === 'open';
            return (
              <article className="dashboard-event-row" key={event.eventId}>
                <div className="dashboard-event-info">
                  <div className="dashboard-event-title-row">
                    <strong className="dashboard-event-name">{event.eventName}</strong>
                    {event.category && <span className="category-pill">{event.category}</span>}
                  </div>
                  <div className="dashboard-event-meta">
                    <span className="dashboard-event-venue">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {event.venue || 'Venue TBD'}
                    </span>
                    <span className="dashboard-event-regs">
                      {event.registrations || 0} registered
                    </span>
                  </div>
                </div>
                <div className="dashboard-event-actions">
                  <span className={`status-pill status-pill--${currentStatus}`}>
                    <span className="status-dot" />
                    {currentStatus.toUpperCase()}
                  </span>
                  {onToggleEventStatus && (
                    <button
                      type="button"
                      className={`button button-sm ${isOpen ? 'button-close' : 'button-open'}`}
                      onClick={() => onToggleEventStatus(event.eventId, currentStatus)}
                    >
                      {isOpen ? 'Close Event' : 'Open Event'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Card>

      {/* Analytics & Recent Activity Grid */}
      <div className="admin-grid bionis-dashboard-grid">
        <Card className="bionis-event-demand">
          <CardTitle>Event Demand</CardTitle>
          {hasRegistrations ? (
            <div style={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventData} layout="vertical" margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                  <CartesianGrid horizontal={false} stroke="rgba(255, 255, 255, 0.08)" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="eventName" width={140} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                  <Bar dataKey="registrations" fill="#38bdf8" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty-state">
              <p>No registrations yet — chart will populate once events open.</p>
            </div>
          )}
        </Card>

        <Card className="bionis-recent-activity">
          <CardTitle>Recent Activity</CardTitle>
          {recentList.length > 0 ? (
            <div className="recent-list">
              {recentList.map((registration) => (
                <div key={registration.registrationId} className="recent-item">
                  <span>{registration.registrationId}</span>
                  <strong>{registration.participant?.name}</strong>
                  <small>{registration.eventRegistrations?.map((event) => event.eventName).join(', ')}</small>
                  <span className={`status-pill status-pill--${registration.paymentStatus}`}>{registration.paymentStatus}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="recent-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No recent registrations yet.</p>
            </div>
          )}
        </Card>
      </div>

      {/* System Health & Storage */}
      <Card className="storage-monitor">
        <div className="storage-monitor__heading">
          <div>
            <span className="kicker">DATABASE STORAGE</span>
            <h2>System Health &amp; Storage</h2>
          </div>
          <strong>{usage === null ? 'Operational' : `${usage}% used`}</strong>
        </div>
        {usage === null ? (
          <p>Database connection and replica state are healthy. Registration, scheduling, and email workers are operational.</p>
        ) : (
          <>
            <div className={`storage-meter ${usage >= 85 ? 'storage-meter--warning' : ''}`}>
              <i style={{ width: `${usage}%` }} />
            </div>
            <div className="storage-monitor__values">
              <span>{formatBytes(usedBytes)} used</span>
              <span>{formatBytes(overview.storage?.limitBytes || 0)} limit</span>
              <span>{formatBytes(overview.storage?.indexBytes || 0)} indexes</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function MetricCard({ label, value, subtext, tone }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subtext && <small>{subtext}</small>}
    </article>
  );
}

function formatBytes(value) {
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(0, Math.round(value / 1024))} KB`;
}
