import { useEffect, useRef, useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';

export function CheckInTab({ authHeaders }) {
  const [registrationId, setRegistrationId] = useState('');
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState({ confirmed: 0, checkedIn: 0 });
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
    if (response.ok) setSummary(await response.json());
  };

  useEffect(() => {
    load();
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
    if (response.ok) setWalkIn({ name: '', college: '', eventId: '' });
  };

  return (
    <section className="admin-panel check-in-panel">
      <h2>Check-in desk</h2>
      <p>Scan the registration QR code or enter the registration ID / token to check in participants.</p>
      {cameraOpen && <div id="admin-qr-reader" className="check-in-camera" aria-label="QR scanner camera" />}
      <div className="check-in-actions">
        <button className="button button-secondary" type="button" onClick={() => setCameraOpen((open) => !open)}>
          {cameraOpen ? 'Close camera' : 'Open camera'}
        </button>
        <small>Camera QR scanning loads only when opened</small>
      </div>
      <form onSubmit={scan} className="admin-form">
        <input
          value={registrationId}
          onChange={(event) => setRegistrationId(event.target.value)}
          placeholder="Scan QR or enter NOC26-XXXXXX"
          autoFocus
        />
        <button className="button button-primary" disabled={!registrationId.trim()}>
          Check in
        </button>
      </form>
      {result && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 16px',
            borderRadius: 8,
            background: result.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: result.ok ? '#4ade80' : '#f87171',
            border: `1px solid ${result.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          <strong style={{ display: 'block', fontSize: 15 }}>{result.message}</strong>
          {result.registration && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1' }}>
              <span>Events: {(result.registration.eventRegistrations || []).map((e) => e.eventName).join(', ')}</span>
              <span style={{ marginLeft: 12 }}>ID: {result.registration.registrationId}</span>
            </div>
          )}
        </div>
      )}
      <div className="admin-metrics">
        <article>
          <span>Checked in</span>
          <strong>{summary.checkedIn}</strong>
        </article>
        <article>
          <span>Confirmed</span>
          <strong>{summary.confirmed}</strong>
        </article>
      </div>
      <details className="walk-in-form">
        <summary>Manual walk-in registration</summary>
        <form onSubmit={createWalkIn} className="admin-form">
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
            placeholder="Event ID e.g. ideathon"
          />
          <button className="button button-primary">Create walk-in</button>
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
