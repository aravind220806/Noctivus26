import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';

export function AdminAccessTab({ authHeaders, onChanged }) {
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
    const response = await adminFetch(apiPath(`/api/admin/access/${encodeURIComponent(email)}`), {
      method: 'DELETE',
      headers: authHeaders,
    });
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
            required
            maxLength="190"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="user@gmail.com"
          />
        </label>
        <label className="field">
          <span>Name</span>
          <input
            maxLength="80"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Optional"
          />
        </label>
        <fieldset className="access-tabs">
          <legend>Allowed tabs</legend>
          {availableTabs.map((tab) => (
            <label key={tab}>
              <input type="checkbox" checked={form.tabs.includes(tab)} onChange={() => toggleTab(tab)} />
              <span>{tab}</span>
            </label>
          ))}
        </fieldset>
        <button className="button button-primary" type="submit" disabled={loading || !form.email || !form.tabs.length}>
          {loading ? 'Saving...' : 'Save access'} <Icon name="shield" />
        </button>
      </form>
      <section className="admin-panel access-list">
        <h2>Current admin users</h2>
        {users.length === 0 ? (
          <p className="admin-empty">No delegated admin users found.</p>
        ) : (
          users.map((user) => (
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
          ))
        )}
      </section>
    </div>
  );
}
