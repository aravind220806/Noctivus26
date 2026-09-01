import { useEffect, useRef, useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';

export function CheckInTab({ authHeaders }) {
  const [registrationId, setRegistrationId] = useState('');
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState({
    totalMembers: 0,
    confirmed: 0,
    checkedIn: 0,
    walkIns: 0,
    pendingCheckIn: 0,
    recentCheckIns: [],
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [walkIn, setWalkIn] = useState({ name: '', college: '', eventId: '' });
  const [verifiedModalData, setVerifiedModalData] = useState(null);
  const scannerRef = useRef(null);

  const extractCleanId = (raw) => {
    const trimmed = (raw || '').trim();
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsed = new URL(trimmed);
        const segments = parsed.pathname.split('/').filter(Boolean);
        return segments[segments.length - 1] || trimmed;
      }
    } catch {
      // ignore
    }
    if (trimmed.includes('/')) {
      const segments = trimmed.split('/').filter(Boolean);
      return segments[segments.length - 1] || trimmed;
    }
    return trimmed;
  };

  const load = async () => {
    const response = await adminFetch(apiPath('/api/admin/check-in/summary'), { headers: authHeaders });
    if (response.ok) {
      const data = await response.json();
      setSummary(data);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // Poll summary every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let active = true;
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        if (!active) return;
        const scanner = new Html5Qrcode('admin-qr-reader');
        scannerRef.current = scanner;
        return scanner
          .start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (value) => {
              const clean = extractCleanId(value);
              setRegistrationId(clean);
              setCameraOpen(false);
              performCheckIn(clean);
            },
            () => {}
          )
          .catch((error) =>
            setResult({
              ok: false,
              message:
                error?.name === 'NotAllowedError'
                  ? 'Camera permission was denied. Allow camera access, then try again.'
                  : 'Camera could not start. Use HTTPS or localhost and enter the registration ID manually.',
            })
          );
      })
      .catch(() => setResult({ ok: false, message: 'QR scanner could not load. Enter the registration ID manually.' }));
    return () => {
      active = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner)
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner.clear().catch(() => {}));
    };
  }, [cameraOpen]);

  const performCheckIn = async (idToScan) => {
    const cleanId = extractCleanId(idToScan);
    if (!cleanId) return;
    const response = await adminFetch(apiPath(`/api/admin/check-in/${encodeURIComponent(cleanId)}`), {
      method: 'POST',
      headers: authHeaders,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      const reg = data.registration || {};
      const p = reg.participant || {};
      setResult({
        ok: true,
        status: data.status,
        message:
          data.status === 'already-checked-in'
            ? `Already checked in at ${new Date(data.checkedInAt || reg.checkedInAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}: ${p.name || reg.registrationId}`
            : `✅ Checked in successfully: ${p.name || reg.registrationId} (${p.college || ''})`,
        registration: reg,
      });
      setVerifiedModalData(reg);
      load();
    } else {
      setResult({
        ok: false,
        status: 'error',
        message: data.detail || data.message || `Check-in failed (${response.status}).`,
      });
    }
    setRegistrationId('');
  };

  const scan = async (event) => {
    if (event) event.preventDefault();
    await performCheckIn(registrationId);
  };

  const createWalkIn = async (event) => {
    event.preventDefault();
    const response = await adminFetch(apiPath('/api/admin/walk-ins'), {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant: { name: walkIn.name, college: walkIn.college }, eventId: walkIn.eventId }),
    });
    const data = await response.json().catch(() => ({}));
    setResult({
      ok: response.ok,
      message: response.ok
        ? `Walk-in created: ${data.registration?.registrationId}`
        : data.detail || data.message || 'Unable to create walk-in.',
    });
    if (response.ok) {
      setWalkIn({ name: '', college: '', eventId: '' });
      load();
    }
  };

  const checkInRate = summary.confirmed > 0
    ? Math.round((summary.checkedIn / summary.confirmed) * 100)
    : 0;

  return (
    <section className="admin-panel check-in-panel">
      <div className="check-in-header">
        <div>
          <h2>Check-in Desk &amp; Member Entry</h2>
          <p className="admin-help">
            Scan the registration pass QR code or enter the registration ID to verify and admit participants to the symposium.
          </p>
        </div>
        <button className="button button-secondary button-small" type="button" onClick={load}>
          🔄 Refresh Counts
        </button>
      </div>

      {/* Comprehensive Entry & Registration Metrics */}
      <div className="admin-metrics check-in-metrics-grid">
        <article className="metric-card metric-card--total">
          <span className="metric-label">Total Registered Members</span>
          <strong className="metric-val">{summary.totalMembers}</strong>
          <small className="metric-sub">All submissions in system</small>
        </article>

        <article className="metric-card metric-card--confirmed">
          <span className="metric-label">Confirmed &amp; Eligible</span>
          <strong className="metric-val">{summary.confirmed}</strong>
          <small className="metric-sub">Payment verified participants</small>
        </article>

        <article className="metric-card metric-card--entered">
          <span className="metric-label">Entered (Checked In)</span>
          <strong className="metric-val" style={{ color: 'var(--cyan, #00c8e0)' }}>
            {summary.checkedIn}
          </strong>
          <small className="metric-sub">{checkInRate}% of confirmed participants</small>
        </article>

        <article className="metric-card metric-card--pending">
          <span className="metric-label">Pending Entry</span>
          <strong className="metric-val" style={{ color: '#f59e0b' }}>
            {summary.pendingCheckIn ?? Math.max(0, summary.confirmed - summary.checkedIn)}
          </strong>
          <small className="metric-sub">Yet to arrive at reception</small>
        </article>

        <article className="metric-card metric-card--walkin">
          <span className="metric-label">Walk-in Registrations</span>
          <strong className="metric-val">{summary.walkIns || 0}</strong>
          <small className="metric-sub">Spot desk entries</small>
        </article>
      </div>

      {cameraOpen && <div id="admin-qr-reader" className="check-in-camera" aria-label="QR scanner camera" />}
      
      <div className="check-in-actions">
        <button className="button button-secondary" type="button" onClick={() => setCameraOpen((open) => !open)}>
          {cameraOpen ? '📷 Close Camera' : '📷 Open Camera Scanner'}
        </button>
        <small style={{ color: '#94a3b8' }}>Camera QR scanning activates rear lens on mobile / webcam on laptop</small>
      </div>

      <form onSubmit={scan} className="admin-form check-in-scan-form">
        <input
          value={registrationId}
          onChange={(event) => setRegistrationId(event.target.value)}
          placeholder="Scan QR or enter NOC26-XXXXXX"
          autoFocus
        />
        <button className="button button-primary" disabled={!registrationId.trim()}>
          Check In Member
        </button>
      </form>

      {result && (
        <div
          style={{
            marginTop: 14,
            padding: '14px 18px',
            borderRadius: 8,
            background: result.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: result.ok ? '#4ade80' : '#f87171',
            border: `1px solid ${result.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          <strong style={{ display: 'block', fontSize: 16 }}>{result.message}</strong>
          {result.registration && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span><strong>Events:</strong> {(result.registration.eventRegistrations || []).map((e) => e.eventName).join(', ')}</span>
              <span><strong>ID:</strong> {result.registration.registrationId}</span>
              <span><strong>College:</strong> {result.registration.participant?.college || '—'}</span>
            </div>
          )}
        </div>
      )}

      {/* Live Feed: Recent Checked-in Members */}
      {summary.recentCheckIns && summary.recentCheckIns.length > 0 && (
        <div className="recent-checkins-section" style={{ marginTop: '28px' }}>
          <h3 style={{ fontSize: '16px', color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ Recent Check-ins</span>
            <span style={{ fontSize: '12px', background: 'rgba(0,200,224,0.15)', color: '#00c8e0', padding: '2px 8px', borderRadius: '12px' }}>
              Live Entry Stream
            </span>
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Entry Time</th>
                  <th>ID</th>
                  <th>Participant Name</th>
                  <th>College</th>
                  <th>Registered Events</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentCheckIns.map((item) => (
                  <tr key={item.registrationId}>
                    <td style={{ whiteSpace: 'nowrap', color: '#00c8e0', fontWeight: 600 }}>
                      {item.checkedInAt
                        ? new Date(item.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Just now'}
                    </td>
                    <td><code>{item.registrationId}</code></td>
                    <td><strong>{item.participant?.name || '—'}</strong></td>
                    <td style={{ color: '#94a3b8' }}>{item.participant?.college || '—'}</td>
                    <td>
                      {(item.eventRegistrations || []).map((e) => e.eventName || e.eventId).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details className="walk-in-form" style={{ marginTop: '28px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#38bdf8' }}>
          + Manual Walk-in (Spot Registration)
        </summary>
        <form onSubmit={createWalkIn} className="admin-form" style={{ marginTop: '12px' }}>
          <input
            required
            value={walkIn.name}
            onChange={(event) => setWalkIn({ ...walkIn, name: event.target.value })}
            placeholder="Participant name"
          />
          <input
            required
            value={walkIn.college}
            onChange={(event) => setWalkIn({ ...walkIn, college: event.target.value })}
            placeholder="College"
          />
          <input
            required
            value={walkIn.eventId}
            onChange={(event) => setWalkIn({ ...walkIn, eventId: event.target.value })}
            placeholder="Event ID e.g. ignite, ideathon"
          />
          <button className="button button-primary">Create Spot Walk-in</button>
        </form>
      </details>

      {/* Verified Member Details Popup Modal */}
      {verifiedModalData && (
        <div className="admin-modal-overlay" onClick={() => setVerifiedModalData(null)}>
          <div className="verified-checkin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="verified-modal-badges">
              <span className="badge-authentic">✓ AUTHENTIC PASS</span>
              <span className="badge-verified">
                Payment {verifiedModalData.paymentStatus === 'confirmed' ? 'Verified' : verifiedModalData.paymentStatus}
              </span>
            </div>

            <div className="verified-modal-passenger">
              <span className="verified-label">PASSENGER NAME</span>
              <h2>{verifiedModalData.participant?.name || 'Participant'}</h2>
              <span className="verified-college">{verifiedModalData.participant?.college || 'Institution'}</span>
            </div>

            <div className="verified-modal-grid2">
              <div className="verified-info-box">
                <span className="verified-label">REGISTRATION ID</span>
                <strong className="reg-id-val">{verifiedModalData.registrationId}</strong>
              </div>
              <div className="verified-info-box">
                <span className="verified-label">DATE</span>
                <strong className="date-val">26 SEP 2026</strong>
              </div>
            </div>

            <div className="verified-modal-events">
              <span className="verified-label">REGISTERED EVENTS ({(verifiedModalData.eventRegistrations || []).length})</span>
              <div className="verified-events-list">
                {(verifiedModalData.eventRegistrations || []).map((ev, idx) => (
                  <div key={idx} className="verified-event-card">
                    <div className="verified-event-top">
                      <strong>{ev.eventName || ev.eventId}</strong>
                      <span className="event-cat-tag">{ev.category || 'Technical'}</span>
                    </div>
                    <div className="verified-event-meta">
                      <span>⏰ {ev.time || '09:00 AM'}</span>
                      <span>📍 {ev.venue || 'Main Auditorium'}</span>
                      <span>🚪 {ev.gate || 'VEC Gate 1'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="verified-status-banner">
              <div className="status-check-title">✅ Participant Checked In</div>
              <div className="status-check-time">
                Checked in at{' '}
                {verifiedModalData.checkedInAt
                  ? new Date(verifiedModalData.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <button
              type="button"
              className="continue-scanning-btn"
              onClick={() => {
                setVerifiedModalData(null);
                setRegistrationId('');
                setCameraOpen(true);
              }}
            >
              ← Back to Check-in (Continue Scanning)
            </button>

            <div className="verified-modal-footer">Velammal Engineering College • Chennai, Tamil Nadu</div>
          </div>
        </div>
      )}
    </section>
  );
}
