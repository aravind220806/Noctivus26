import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';

export function InvitationsTab({ authHeaders, onSent }) {
  const [stats, setStats] = useState({ totalEligible: 0, sentCount: 0, failedCount: 0, unsentCount: 0 });
  const [batchCount, setBatchCount] = useState('');
  const [lastBatchResult, setLastBatchResult] = useState(null);
  const [passPreviewUrl, setPassPreviewUrl] = useState('');
  const [previewMessage, setPreviewMessage] = useState('Generating boarding pass preview...');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch(apiPath('/api/admin/invitations/stats'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // stats error fallback
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
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
        const url = URL.createObjectURL(blob);
        setPassPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return url;
        });
        setPreviewMessage('');
      })
      .catch((previewError) => {
        if (controller.signal.aborted) return;
        setPassPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return '';
        });
        setPreviewMessage(previewError.message || 'Boarding pass preview unavailable.');
      });
    return () => controller.abort();
  }, [authHeaders]);

  const handleSendBatch = async () => {
    const count = parseInt(batchCount, 10);
    if (!count || count <= 0) {
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
        setLastBatchResult(data);
        if (onSent) onSent(data.succeeded || 0);
        await fetchStats();
        setBatchCount('');
      } else {
        setError(data.detail || data.message || 'Failed to execute batch send.');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the pass dispatch service.');
    } finally {
      setSending(false);
    }
  };

  const handleResendFailed = async () => {
    if (!lastBatchResult || !lastBatchResult.failedList || lastBatchResult.failedList.length === 0) return;
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
        setLastBatchResult((prev) => {
          if (!prev) return data;
          const updatedSuccessful = [...prev.successful, ...(data.successful || [])];
          const updatedFailedList = data.failedList || [];
          return {
            attempted: prev.attempted,
            succeeded: updatedSuccessful.length,
            failed: updatedFailedList.length,
            successful: updatedSuccessful,
            failedList: updatedFailedList,
          };
        });
        if (onSent) onSent(data.succeeded || 0);
        await fetchStats();
      } else {
        setError(data.detail || data.message || 'Failed to resend passes.');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the pass dispatch service.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="admin-grid admin-grid--wide invitation-automation">
      <section className="admin-panel pass-builder">
        <h2>Send Boarding Passes</h2>
        <p className="admin-help">
          Batch send personalized symposium boarding passes to confirmed members who have not received their pass yet.
        </p>

        <div className="batch-stats-summary">
          <div className="batch-stat-box stat-eligible">
            <span>Eligible Confirmed</span>
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

        <div className="batch-send-form">
          <label className="field">
            <span>Number of passes to send today</span>
            <div className="batch-input-row">
              <input
                type="number"
                min="1"
                placeholder="e.g. 10"
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                disabled={sending || stats.unsentCount === 0}
              />
              <button
                type="button"
                className="button button-primary batch-send-btn"
                disabled={!batchCount || parseInt(batchCount, 10) <= 0 || sending || stats.unsentCount === 0}
                onClick={handleSendBatch}
              >
                {sending ? 'Sending Batch...' : 'Send Batch'} <Icon name="mail" />
              </button>
            </div>
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        {lastBatchResult && (
          <div className="batch-results-panel">
            <div className="batch-results-header">
              <h3>Batch Send Results</h3>
              <small>Attempted: {lastBatchResult.attempted}</small>
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
                    disabled={resending || (lastBatchResult.failedList || []).length === 0}
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
          {!passPreviewUrl && <div className="boarding-pass-empty">{previewMessage}</div>}
        </div>
      </section>
    </div>
  );
}
