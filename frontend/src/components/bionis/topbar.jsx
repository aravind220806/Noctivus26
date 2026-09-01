import { BionisIcons } from './icons';

export function Topbar({
  activeTab,
  onRefresh,
  onMenuToggle,
  autoRefresh = true,
  onToggleAutoRefresh,
  isRefreshing = false,
  lastRefreshedAt,
}) {
  const timeString = lastRefreshedAt
    ? new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <header className="admin-topbar bionis-topbar">
      <div className="admin-topbar-left">
        <button className="admin-menu-toggle" type="button" onClick={onMenuToggle} aria-label="Toggle admin menu">
          <BionisIcons.menu size={20} />
        </button>
        <div className="admin-topbar-title-wrap">
          <span className="kicker">ADMIN PANEL</span>
          <h1>{activeTab}</h1>
        </div>
      </div>
      <div className="admin-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          className={`button-auto-refresh ${autoRefresh ? 'active' : ''}`}
          onClick={onToggleAutoRefresh}
          title={autoRefresh ? 'Auto-refresh active (every 15s). Click to pause.' : 'Auto-refresh paused. Click to enable.'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: autoRefresh ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
            border: autoRefresh ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
            color: autoRefresh ? '#4ade80' : 'var(--muted)',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: autoRefresh ? '#22c55e' : '#71717a',
              boxShadow: autoRefresh ? '0 0 8px #22c55e' : 'none',
              display: 'inline-block',
            }}
          />
          <span>{autoRefresh ? 'Live Sync' : 'Sync Paused'}</span>
        </button>

        <button
          className="button button-refresh"
          type="button"
          onClick={() => onRefresh && onRefresh(false)}
          disabled={isRefreshing}
          title={timeString ? `Last updated: ${timeString}` : 'Refresh admin data'}
        >
          <BionisIcons.refresh size={15} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isRefreshing ? 'SYNCING...' : 'REFRESH'}</span>
        </button>
      </div>
    </header>
  );
}
