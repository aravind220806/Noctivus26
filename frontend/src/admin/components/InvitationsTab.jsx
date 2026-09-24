import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';

export function InvitationsTab({ authHeaders, onSent }) {
  const [stats, setStats] = useState({ totalEligible: 0, sentCount: 0, failedCount: 0, unsentCount: 0 });
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatus, setMemberStatus] = useState('all');
  const [memberPage, setMemberPage] = useState(0);
  const [batchCount, setBatchCount] = useState('');
  const [lastBatchResult, setLastBatchResult] = useState(null);
  const [passPreviewUrl, setPassPreviewUrl] = useState('');
  const [previewMessage, setPreviewMessage] = useState('Generating boarding pass preview...');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [jobId, setJobId] = useState(() => sessionStorage.getItem('invitationJobId') || '');
  const batchActive = sending || resending || Boolean(jobId);

  const trackJob = (data) => {
    if (!data.jobId) throw new Error('Batch response is missing its tracking ID. Refresh the page after the server update.');
    setLastBatchResult(data);
    sessionStorage.setItem('invitationJobId', data.jobId);
    setJobId(data.jobId);
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch(apiPath('/api/admin/invitations/stats'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        const latest = data.automation?.latestJob;
        if (latest && ['queued', 'running'].includes(latest.status)) {
          setJobId((current) => current || latest.jobId);
          sessionStorage.setItem('invitationJobId', latest.jobId);
        }
        if (latest) setLastBatchResult((current) => current || latest);
      }
    } catch {
      // stats error fallback
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 5000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const response = await adminFetch(apiPath(`/api/admin/invitations/jobs/${encodeURIComponent(jobId)}`), { headers: authHeaders });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.status === 404) {
          sessionStorage.removeItem('invitationJobId');
          setJobId('');
          setError('This batch is no longer available. Refresh the counts before starting another batch.');
          await fetchStats();
          return;
        }
        if (!response.ok) throw new Error(data.detail || `Unable to read batch progress (${response.status}).`);
        setLastBatchResult(data);
        setError('');
        if (data.status === 'completed' || data.status === 'interrupted') {
          sessionStorage.removeItem('invitationJobId');
          setJobId('');
          if (data.message) setError(data.message);
          if (onSent) onSent(data.succeeded || 0);
          await fetchStats();
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setError(`${err.message} Sending may still be in progress; reconnecting automatically.`);
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobId, authHeaders, onSent, fetchStats]);

  const [previewRetryCount, setPreviewRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    setPreviewMessage('Generating boarding pass preview...');

    adminFetch(apiPath('/api/admin/invitations/preview'), {
      method: 'GET',
      headers: authHeaders,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) return response.blob();
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.message || `Preview unavailable (${response.status}).`);
      })
      .then((blob) => {
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        setPassPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return url;
        });
        setPreviewMessage('');
      })
      .catch((previewError) => {
        if (!isMounted || controller.signal.aborted || previewError.name === 'AbortError') return;
        setPassPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return '';
        });
        const isNetworkErr = String(previewError.message || '').toLowerCase().includes('network') || String(previewError.message || '').toLowerCase().includes('failed to fetch');
        setPreviewMessage(isNetworkErr ? 'Preview temporarily unavailable. Reconnecting...' : (previewError.message || 'Boarding pass preview unavailable.'));
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [authHeaders, previewRetryCount]);

  const handleSendBatch = async () => {
    if (batchActive) return;
    const count = Number(batchCount);
    if (!Number.isInteger(count) || count <= 0) {
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
        trackJob(data);
        setBatchCount('');
      } else {
        setError(data.detail || data.message || data.error || `Unable to start batch (HTTP ${res.status}). Check batch progress before retrying.`);
      }
    } catch (err) {
      const isNetErr = String(err?.message || '').toLowerCase().includes('network') || String(err?.message || '').toLowerCase().includes('failed to fetch');
      setError(isNetErr ? 'Connection lost. Sending may still be in progress; reconnect before retrying.' : (err?.message || 'Unable to connect to the pass dispatch service.'));
    } finally {
      setSending(false);
    }
  };

  const handleResendFailed = async () => {
    if (batchActive || !lastBatchResult || !lastBatchResult.failedList || lastBatchResult.failedList.length === 0) return;
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
        trackJob(data);
      } else {
        setError(data.detail || data.message || 'Failed to resend passes.');
      }
    } catch (err) {
      const isNetErr = String(err?.message || '').toLowerCase().includes('network') || String(err?.message || '').toLowerCase().includes('failed to fetch');
      setError(isNetErr ? 'Connection lost. Sending may still be in progress; reconnect before retrying.' : (err?.message || 'Unable to connect to the pass dispatch service.'));
    } finally {
      setResending(false);
    }
  };

  const statusLabels = { awaiting_payment: 'Awaiting payment', waiting: 'Waiting', queued: 'Queued', sending: 'Sending', done: 'Done', failed: 'Failed', interrupted: 'Interrupted' };
  const filteredMembers = (stats.members || []).filter((member) =>
    (memberStatus === 'all' || member.status === memberStatus) &&
    `${member.name} ${member.email} ${member.registrationId}`.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / 50));
  const currentPage = Math.min(memberPage, pageCount - 1);
  const visibleMembers = filteredMembers.slice(currentPage * 50, (currentPage + 1) * 50);
  const displayTime = (value) => value ? new Date(value).toLocaleString() : '—';

  return (
    <div className="admin-grid admin-grid--wide invitation-automation">
      <section className="admin-panel pass-builder">
        <h2>Automatic Boarding Pass Delivery</h2>
        <p className="admin-help">
          {stats.automation?.enabled
            ? `Verified payments automatically enter the pass queue. Deliveries start ${stats.automation.intervalSeconds || 1} second(s) apart, including previously verified participants who have not received a pass.`
            : 'Automatic delivery is paused. You can send a batch manually below.'}
        </p>

        {stats.automation?.enabled && !stats.automation.emailConfigured && (
          <p className="form-error">Automatic delivery is waiting for the email service to be configured.</p>
        )}
        <p className="admin-help">Failed or interrupted deliveries require review before retrying. You can monitor progress here; this page does not need to stay open.</p>
        <div className="batch-stats-summary">
          <div className="batch-stat-box stat-registered">
            <span>Total Registered</span>
            <strong>{stats.totalRegistered ?? stats.totalEligible ?? 0}</strong>
          </div>
          <div className="batch-stat-box stat-eligible">
            <span>Eligible (Confirmed)</span>
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

        <section aria-label="Member pass delivery status" style={{ margin: '24px 0' }}>
          <h3>All Members — Pass Status</h3>
          <p className="admin-help">Waiting → Queued → Sending → Done. Status refreshes every five seconds. Done means the email service accepted the pass.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <label className="field">
              <span>Search members</span>
              <input value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setMemberPage(0); }} placeholder="Name, email or registration ID" />
            </label>
            <label className="field">
              <span>Delivery status</span>
              <select value={memberStatus} onChange={(event) => { setMemberStatus(event.target.value); setMemberPage(0); }}>
                <option value="all">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr>{['Member', 'Email', 'Status', 'Started', 'Completed', 'Details'].map((label) => <th key={label} scope="col" style={{ padding: 10 }}>{label}</th>)}</tr></thead>
              <tbody>
                {visibleMembers.map((member) => (
                  <tr key={member.registrationId} style={{ borderTop: '1px solid rgba(148,163,184,.2)' }}>
                    <td style={{ padding: 10 }}><strong>{member.name}</strong><br /><small>{member.registrationId}</small></td>
                    <td style={{ padding: 10, overflowWrap: 'anywhere' }}>{member.email || '—'}</td>
                    <td style={{ padding: 10, whiteSpace: 'nowrap', color: member.status === 'done' ? '#4ade80' : ['failed', 'interrupted'].includes(member.status) ? '#fca5a5' : '#93c5fd' }}>{statusLabels[member.status] || member.status}</td>
                    <td style={{ padding: 10 }}>{displayTime(member.startedAt)}</td>
                    <td style={{ padding: 10 }}>{displayTime(member.completedAt)}</td>
                    <td style={{ padding: 10 }}>{member.reason || '—'}</td>
                  </tr>
                ))}
                {!visibleMembers.length && <tr><td colSpan={6} style={{ padding: 16 }}>No members match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
            <button type="button" className="button" disabled={currentPage === 0} onClick={() => setMemberPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage + 1} of {pageCount} · {filteredMembers.length} members</span>
            <button type="button" className="button" disabled={currentPage + 1 >= pageCount} onClick={() => setMemberPage(currentPage + 1)}>Next</button>
          </div>
        </section>

        {stats.totalEligible === 0 && (stats.totalRegistered || 0) > 0 && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontSize: '13px' }}>
            💡 <strong>Note:</strong> You have {stats.totalRegistered} registered participant(s) awaiting payment confirmation. Go to <strong>Verify Members</strong> to verify and confirm their payment before boarding passes can be generated.
          </div>
        )}

        <div className="batch-send-form">
          <label className="field">
            <span>Send a manual batch (optional)</span>
            <div className="batch-input-row">
              <input
                type="number"
                min="1"
                placeholder="e.g. 10"
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                disabled={batchActive || stats.unsentCount === 0}
              />
              <button
                type="button"
                className="button button-primary batch-send-btn"
                disabled={!batchCount || parseInt(batchCount, 10) <= 0 || batchActive || stats.unsentCount === 0}
                onClick={handleSendBatch}
              >
                {batchActive ? 'Sending Batch...' : 'Send Batch'} <Icon name="mail" />
              </button>
            </div>
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        {lastBatchResult && (
          <div className="batch-results-panel">
            <div className="batch-results-header">
              <h3>Batch Send Results</h3>
              <small role="status">{lastBatchResult.status === 'queued' ? 'Queued • ' : ''}Processed: {(lastBatchResult.succeeded || 0) + (lastBatchResult.failed || 0)} / {lastBatchResult.attempted}{lastBatchResult.status === 'completed' ? ' • Complete' : ''}</small>
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
                  <p className="admin-help" style={{ margin: '6px 0' }}>
                    No successful sends in this batch.
                  </p>
                ) : (
                  (lastBatchResult.successful || []).map((item) => (
                    <div key={item.registrationId} className="batch-item-row">
                      <div className="member-info">
                        <span className="member-name">
                          {item.name} <small>({item.registrationId})</small>
                        </span>
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
                  <span style={{ fontSize: '12px', color: '#fca5a5' }}>
                    {(lastBatchResult.failedList || []).length} failed send
                    {(lastBatchResult.failedList || []).length === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    className="button-resend-failed"
                    disabled={batchActive || (lastBatchResult.failedList || []).length === 0}
                    onClick={handleResendFailed}
                  >
                    {resending ? 'Resending...' : 'Resend Failed'} <Icon name="refresh" />
                  </button>
                </div>
              )}
              <div className="batch-list-items">
                {(lastBatchResult.failedList || []).length === 0 ? (
                  <p className="admin-help" style={{ margin: '6px 0' }}>
                    No failed passes.
                  </p>
                ) : (
                  (lastBatchResult.failedList || []).map((item) => (
                    <div key={item.registrationId} className="batch-item-row">
                      <div className="member-info">
                        <span className="member-name">
                          {item.name} <small>({item.registrationId})</small>
                        </span>
                        <span className="member-email">{item.email}</span>
                      </div>
                      <span className="batch-failure-badge" title={item.reason}>
                        {item.reason}
                      </span>
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
          {passPreviewUrl && (
            <img className="boarding-pass-render" src={passPreviewUrl} alt="Personalized symposium boarding pass sample" />
          )}
          {!passPreviewUrl && (
            <div className="boarding-pass-empty">
              <p>{previewMessage}</p>
              <button
                type="button"
                className="button button-secondary button-small"
                style={{ marginTop: 12 }}
                onClick={() => setPreviewRetryCount((c) => c + 1)}
              >
                Reload Preview
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
