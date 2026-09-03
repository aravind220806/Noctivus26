import { useCallback, useEffect, useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';

function formatActionBadge(action) {
  if (!action) return <span className="audit-badge audit-badge--default">action</span>;
  const a = action.toLowerCase();
  let badgeClass = 'audit-badge--default';
  let icon = '⚡';

  if (a.includes('check-in')) {
    badgeClass = 'audit-badge--success';
    icon = '✅';
  } else if (a.includes('confirmed')) {
    badgeClass = 'audit-badge--primary';
    icon = '💳';
  } else if (a.includes('mismatch') || a.includes('duplicate') || a.includes('deactivate')) {
    badgeClass = 'audit-badge--danger';
    icon = '⚠️';
  } else if (a.includes('walk-in')) {
    badgeClass = 'audit-badge--walkin';
    icon = '🚶';
  } else if (a.includes('login') || a.includes('auth')) {
    badgeClass = 'audit-badge--info';
    icon = '🔑';
  } else if (a.includes('invitation') || a.includes('pass')) {
    badgeClass = 'audit-badge--pass';
    icon = '🎫';
  } else if (a.includes('export')) {
    badgeClass = 'audit-badge--export';
    icon = '📥';
  }

  return (
    <span className={`audit-badge ${badgeClass}`}>
      <span className="audit-badge-icon">{icon}</span>
      {action}
    </span>
  );
}

function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
    return <span style={{ color: '#64748b', fontSize: '12px' }}>—</span>;
  }
  return (
    <div className="audit-meta-pills">
      {Object.entries(metadata).map(([k, v]) => (
        <span key={k} className="audit-meta-pill">
          <strong>{k}:</strong> {String(v)}
        </span>
      ))}
    </div>
  );
}

export function AuditLogTab({ authHeaders }) {
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (query = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      const response = await adminFetch(apiPath(`/api/admin/audit-log?${params.toString()}`), {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setActions(data.actions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, search]);

  useEffect(() => {
    load();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    load(search);
  };

  const handleClear = () => {
    setSearch('');
    load('');
  };

  return (
    <section className="admin-panel audit-panel">
      <div className="audit-panel-header">
        <div>
          <h2>System Audit Log</h2>
          <p className="admin-help">
            Chronological record of all administrative operations, logins, payment verifications, and desk check-ins.
          </p>
        </div>
        <div className="audit-stats-badge">
          <span>Total Records:</span>
          <strong>{actions.length}</strong>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="admin-form audit-search-form">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by admin email, action type, registration ID, target..."
        />
        <button className="button button-primary button-small" type="submit" disabled={loading}>
          {loading ? 'Searching...' : '🔍 Search'}
        </button>
        {search && (
          <button className="button button-secondary button-small" type="button" onClick={handleClear}>
            Clear
          </button>
        )}
        <button
          className="button button-secondary button-small"
          type="button"
          onClick={() => load(search)}
          disabled={loading}
          style={{ marginLeft: 'auto' }}
        >
          🔄 Refresh
        </button>
      </form>

      {actions.length === 0 ? (
        <div className="admin-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <p>No audit records found matching your query.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table audit-table">
            <thead>
              <tr>
                <th style={{ width: '170px' }}>Timestamp</th>
                <th style={{ width: '180px' }}>Admin / Actor</th>
                <th style={{ width: '190px' }}>Action</th>
                <th style={{ width: '160px' }}>Target</th>
                <th>Details &amp; Metadata</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action, index) => {
                const dateObj = action.createdAt ? new Date(action.createdAt) : null;
                const formattedDate = dateObj && !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '—';

                return (
                  <tr key={`${action.createdAt}-${index}`}>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap', color: '#94a3b8' }}>
                      {formattedDate}
                    </td>
                    <td>
                      <span className="audit-actor" title={action.actor}>
                        {action.actor || 'system'}
                      </span>
                    </td>
                    <td>{formatActionBadge(action.action)}</td>
                    <td>
                      <code className="audit-target">{action.target || '—'}</code>
                    </td>
                    <td>{formatMetadata(action.metadata)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
