import { useEffect, useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';

export function AuditLogTab({ authHeaders }) {
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState([]);

  const load = async () => {
    const response = await adminFetch(apiPath(`/api/admin/audit-log?${new URLSearchParams({ search })}`), {
      headers: authHeaders,
    });
    if (response.ok) setActions((await response.json()).actions || []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="admin-panel">
      <h2>Audit log</h2>
      <div className="admin-form">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search actor, action, target"
        />
        <button className="button button-secondary" onClick={load}>
          Search
        </button>
      </div>
      {actions.length === 0 ? (
        <p className="admin-empty">No audit records found.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action, index) => (
                <tr key={`${action.createdAt}-${index}`}>
                  <td>{action.createdAt ? new Date(action.createdAt).toLocaleString() : '—'}</td>
                  <td>{action.actor}</td>
                  <td>{action.action}</td>
                  <td>{action.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
