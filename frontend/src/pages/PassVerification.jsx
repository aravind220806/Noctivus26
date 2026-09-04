import { useEffect, useState } from 'react';
import { getApiBase } from '../lib/api';

const apiBase = getApiBase();
const apiPath = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalizedPath}`;
};

export default function PassVerification() {
  const [tokenOrId, setTokenOrId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState('');

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // path is /p/:tokenOrId
    const param = parts[1] || '';
    setTokenOrId(param);

    if (!param) {
      setError('No boarding pass token or registration ID provided in the link.');
      setLoading(false);
      return;
    }

    fetchPassDetails(param);
  }, []);

  const fetchPassDetails = async (param) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiPath(`/api/p/${encodeURIComponent(param)}`), {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.valid) {
        setData(result);
      } else {
        setError(result.detail || result.message || 'Boarding pass not found or invalid.');
      }
    } catch (err) {
      setError('Unable to verify boarding pass. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!tokenOrId) return;
    setCheckingIn(true);
    setCheckInMessage('');
    try {
      const response = await fetch(apiPath(`/api/p/${encodeURIComponent(tokenOrId)}/check-in`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setCheckInMessage(
          result.status === 'already-checked-in'
            ? 'Participant is already checked in.'
            : '✅ Check-in successful! Welcome to Noctivus \'26.'
        );
        // Refresh details
        await fetchPassDetails(tokenOrId);
      } else {
        setCheckInMessage(result.detail || result.message || 'Check-in failed. Please visit the help desk.');
      }
    } catch (err) {
      setCheckInMessage('Network error while processing check-in.');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <a href="/" style={styles.logoLink}>
          <img src="/brand/noctivus-emblem.webp" alt="Noctivus Emblem" style={styles.logo} />
          <div>
            <h1 style={styles.brandTitle}>NOCTIVUS <span>'26</span></h1>
            <p style={styles.brandSubtitle}>OFFICIAL VERIFICATION DESK</p>
          </div>
        </a>
      </header>

      <main style={styles.main}>
        {loading && (
          <div style={styles.card}>
            <div style={styles.loadingSpinner} />
            <p style={{ color: '#94a3b8', marginTop: 16 }}>Verifying boarding pass authenticity...</p>
          </div>
        )}

        {!loading && error && (
          <div style={styles.card}>
            <div style={styles.errorIcon}>✕</div>
            <h2 style={{ color: '#ef4444', margin: '8px 0' }}>Invalid Pass</h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>{error}</p>
            <a href="/" style={styles.actionBtn}>Return to Homepage</a>
          </div>
        )}

        {!loading && data && (
          <div style={styles.card}>
            {/* Header Badge */}
            <div style={styles.badgeRow}>
              <span style={styles.verifiedBadge}>
                ✓ AUTHENTIC PASS
              </span>
              <span style={data.paymentStatus === 'confirmed' ? styles.statusConfirmed : styles.statusPending}>
                Payment {data.paymentStatus === 'confirmed' ? 'Verified' : data.paymentStatus}
              </span>
            </div>

            <div style={styles.passengerSection}>
              <span style={styles.label}>PASSENGER NAME</span>
              <h2 style={styles.passengerName}>{data.passengerName}</h2>
              <span style={styles.collegeName}>{data.college}</span>
            </div>

            <div style={styles.grid2}>
              <div style={styles.infoBox}>
                <span style={styles.label}>REGISTRATION ID</span>
                <strong style={styles.codeText}>{data.registrationId}</strong>
              </div>
              <div style={styles.infoBox}>
                <span style={styles.label}>DATE</span>
                <strong style={styles.valText}>{data.date || '26 SEP 2026'}</strong>
              </div>
            </div>

            {/* Registered Events */}
            <div style={styles.eventsSection}>
              <span style={styles.label}>REGISTERED EVENTS ({data.events?.length || 0})</span>
              <div style={styles.eventsList}>
                {(data.events || []).map((ev, i) => (
                  <div key={i} style={styles.eventItem}>
                    <div style={styles.eventMain}>
                      <strong style={styles.eventName}>{ev.name}</strong>
                      <span style={styles.eventCategory}>{ev.category}</span>
                    </div>
                    <div style={styles.eventMeta}>
                      <span>⏰ {ev.time || '09:00 AM'}</span>
                      <span>📍 {ev.venue || 'Main Auditorium'}</span>
                      {ev.gate && <span>🚪 {ev.gate}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Check-in status box */}
            <div style={data.checkedIn ? styles.checkInBoxSuccess : styles.checkInBoxPending}>
              <div>
                <strong style={{ display: 'block', fontSize: 16 }}>
                  {data.checkedIn ? '✅ Participant Checked In' : '⏳ Ready for Check-in'}
                </strong>
                <small style={{ color: '#94a3b8' }}>
                  {data.checkedIn
                    ? `Checked in at ${new Date(data.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Present this screen at the symposium entry gate.'}
                </small>
              </div>

              {!data.checkedIn && data.selfCheckInEnabled && (
                <button
                  type="button"
                  style={styles.checkInBtn}
                  disabled={checkingIn || data.paymentStatus !== 'confirmed'}
                  onClick={handleCheckIn}
                >
                  {checkingIn ? 'Checking In...' : '⚡ Check In Now'}
                </button>
              )}
              {!data.checkedIn && !data.selfCheckInEnabled && (
                <small style={{ color: '#94a3b8', maxWidth: 240, textAlign: 'right' }}>
                  Show this pass at the registration desk to check in.
                </small>
              )}
            </div>

            {checkInMessage && (
              <p style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 14,
                textAlign: 'center',
                background: checkInMessage.includes('successful') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: checkInMessage.includes('successful') ? '#4ade80' : '#f87171',
                border: `1px solid ${checkInMessage.includes('successful') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {checkInMessage}
              </p>
            )}

            <div style={styles.footerNote}>
              <small>Velammal Engineering College • Chennai, Tamil Nadu</small>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0b0f19',
    color: '#f3f4f6',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid #1f2937',
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    textDecoration: 'none',
    color: 'inherit',
  },
  logo: {
    width: 44,
    height: 44,
    objectFit: 'contain',
  },
  brandTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '0.05em',
    color: '#fff',
  },
  brandSubtitle: {
    margin: '2px 0 0',
    fontSize: 10,
    fontWeight: 700,
    color: '#3b82f6',
    letterSpacing: '2px',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 16,
    padding: 28,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottom: '1px solid #1f2937',
  },
  verifiedBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '4px 10px',
    borderRadius: 999,
    letterSpacing: '0.5px',
  },
  statusConfirmed: {
    fontSize: 11,
    fontWeight: 700,
    color: '#22c55e',
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    padding: '4px 10px',
    borderRadius: 999,
  },
  statusPending: {
    fontSize: 11,
    fontWeight: 700,
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    padding: '4px 10px',
    borderRadius: 999,
  },
  passengerSection: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 6,
  },
  passengerName: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
  },
  collegeName: {
    display: 'block',
    marginTop: 4,
    fontSize: 14,
    color: '#94a3b8',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#1a2234',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #283548',
  },
  codeText: {
    fontSize: 16,
    color: '#f59e0b',
    fontFamily: 'monospace',
  },
  valText: {
    fontSize: 15,
    color: '#f3f4f6',
  },
  eventsSection: {
    marginBottom: 20,
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  eventItem: {
    backgroundColor: '#1a2234',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #283548',
  },
  eventMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventName: {
    fontSize: 15,
    color: '#fff',
  },
  eventCategory: {
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  eventMeta: {
    display: 'flex',
    gap: 14,
    fontSize: 12,
    color: '#94a3b8',
    flexWrap: 'wrap',
  },
  checkInBoxSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    color: '#4ade80',
  },
  checkInBoxPending: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    color: '#93c5fd',
  },
  checkInBtn: {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: 44,
    transition: 'background 0.2s',
  },
  actionBtn: {
    display: 'inline-block',
    marginTop: 16,
    backgroundColor: '#3b82f6',
    color: '#fff',
    textDecoration: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
  },
  loadingSpinner: {
    width: 36,
    height: 36,
    border: '3px solid rgba(59,130,246,0.2)',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    margin: '20px auto 0',
    animation: 'spin 1s linear infinite',
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    fontSize: 24,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto 12px',
  },
  footerNote: {
    marginTop: 20,
    paddingTop: 14,
    borderTop: '1px solid #1f2937',
    textAlign: 'center',
    color: '#64748b',
  },
};
