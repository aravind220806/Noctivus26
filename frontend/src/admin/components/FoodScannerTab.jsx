import { useEffect, useRef, useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';
import {
  Utensils,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Volume2,
  VolumeX,
  Search,
  RefreshCw,
  Salad,
  Flame,
  ShieldAlert,
  Clock,
  User,
  Building,
  Sparkles,
  Lock,
} from 'lucide-react';

export function FoodScannerTab({ authHeaders }) {
  const [queryId, setQueryId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [verifiedModalData, setVerifiedModalData] = useState(null);
  const [summary, setSummary] = useState({
    totalEligible: 0,
    totalClaimed: 0,
    totalPending: 0,
    vegTotal: 0,
    vegClaimed: 0,
    vegRemaining: 0,
    nonVegTotal: 0,
    nonVegClaimed: 0,
    nonVegRemaining: 0,
    recentClaims: [],
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all | veg | non-veg
  const [searchTerm, setSearchTerm] = useState('');
  const scannerRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Audio synthesize function for high-speed feedback
  const playSound = (type) => {
    if (!audioEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (type === 'success') {
        // High pleasant ding chime (C6 -> G6)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
        osc.frequency.exponentialRampToValueAtTime(1567.98, ctx.currentTime + 0.15); // G6
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'warning' || type === 'error') {
        // Low buzzy double warning tone
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, ctx.currentTime);
        osc1.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
        gain1.gain.setValueAtTime(0.4, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio not permitted or supported
    }
  };

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

  const loadSummary = async () => {
    try {
      const res = await adminFetch(apiPath('/api/admin/food/summary'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load food summary:', err);
    }
  };

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  // HTML5 QR Scanner
  useEffect(() => {
    if (!cameraOpen) return undefined;
    let active = true;
    import('html5-qrcode')
      .then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
        if (!active) return;
        const scanner = new Html5Qrcode('food-qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        scannerRef.current = scanner;
        return scanner
          .start(
            { facingMode: 'environment' },
            {
              fps: 25,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const edgeSize = Math.max(180, Math.floor(minEdge * 0.85));
                return { width: edgeSize, height: edgeSize };
              },
              aspectRatio: 1.0,
            },
            (value) => {
              const clean = extractCleanId(value);
              setQueryId(clean);
              setCameraOpen(false); // Stop camera immediately on recognition
              claimFood(clean);
            },
            () => {}
          )
          .catch((error) => {
            setResult({
              ok: false,
              type: 'error',
              message:
                error?.name === 'NotAllowedError'
                  ? 'Camera permission was denied. Allow camera access in browser settings.'
                  : 'Camera could not start. Please enter Registration ID manually.',
            });
          });
      })
      .catch(() =>
        setResult({
          ok: false,
          type: 'error',
          message: 'QR scanner library failed to load. Use manual lookup.',
        })
      );

    return () => {
      active = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner.clear().catch(() => {}));
      }
    };
  }, [cameraOpen]);

  const claimFood = async (rawInput) => {
    const clean = extractCleanId(rawInput || queryId);
    if (!clean || isProcessing) return;

    setIsProcessing(true);
    try {
      const res = await adminFetch(apiPath(`/api/admin/food/claim/${encodeURIComponent(clean)}`), {
        method: 'POST',
        headers: authHeaders,
      });

      const data = await res.json();
      if (!res.ok) {
        playSound('error');
        const errObj = {
          ok: false,
          type: 'error',
          status: 'error',
          title: 'Not Eligible for Food',
          message: data.detail || 'Could not verify participant.',
          registration: null,
        };
        setResult(errObj);
        setVerifiedModalData(errObj);
        return;
      }

      if (data.status === 'already-claimed') {
        playSound('warning');
        const dupObj = {
          ok: false,
          type: 'already-claimed',
          status: 'already-claimed',
          title: '⚠️ LUNCH ALREADY CLAIMED!',
          message: `This pass was already scanned & food was given at ${
            data.foodClaimedAt
              ? new Date(data.foodClaimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'earlier'
          }.`,
          foodClaimedAt: data.foodClaimedAt,
          foodClaimedBy: data.foodClaimedBy,
          foodPreference: data.foodPreference,
          registration: data.registration,
        };
        setResult(dupObj);
        setVerifiedModalData(dupObj);
      } else {
        playSound('success');
        const successObj = {
          ok: true,
          type: 'success',
          status: 'claimed',
          title: '✅ LUNCH CLAIMED SUCCESSFULLY!',
          message: `Food distribution confirmed for ${data.registration?.participant?.name || 'Participant'}.`,
          foodClaimedAt: data.foodClaimedAt,
          foodClaimedBy: data.foodClaimedBy,
          foodPreference: data.foodPreference,
          registration: data.registration,
        };
        setResult(successObj);
        setVerifiedModalData(successObj);
      }

      setQueryId('');
      loadSummary();
    } catch (err) {
      playSound('error');
      const netErr = {
        ok: false,
        type: 'error',
        status: 'error',
        title: 'Connection Error',
        message: err.message || 'Failed to submit food claim.',
        registration: null,
      };
      setResult(netErr);
      setVerifiedModalData(netErr);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRecentClaims = (summary.recentClaims || []).filter((claim) => {
    const p = claim.participant || {};
    const name = (p.name || '').toLowerCase();
    const id = (claim.registrationId || '').toLowerCase();
    const college = (p.college || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    const matchesSearch = !q || name.includes(q) || id.includes(q) || college.includes(q);
    const prefRaw = (claim.foodPreference || p.foodPreference || '').toLowerCase();
    const isNonVeg = prefRaw.includes('non');

    if (filterType === 'veg') return matchesSearch && !isNonVeg;
    if (filterType === 'non-veg') return matchesSearch && isNonVeg;
    return matchesSearch;
  });

  const totalVeg = summary.vegTotal || 0;
  const claimedVeg = summary.vegClaimed || 0;
  const remainingVeg = summary.vegRemaining || 0;

  const totalNonVeg = summary.nonVegTotal || 0;
  const claimedNonVeg = summary.nonVegClaimed || 0;
  const remainingNonVeg = summary.nonVegRemaining || 0;

  const totalEligible = summary.totalEligible || 0;
  const totalClaimed = summary.totalClaimed || 0;
  const overallPercent = totalEligible > 0 ? Math.round((totalClaimed / totalEligible) * 100) : 0;

  return (
    <div className="food-scanner-container">
      {/* ── TOP KPI BANNER ── */}
      <div className="food-stats-grid">
        {/* Overall Distribution Card */}
        <div className="food-stat-card food-stat-card--total">
          <div className="food-stat-header">
            <div className="food-stat-icon-wrap food-stat-icon--total">
              <Utensils size={22} />
            </div>
            <div>
              <span className="food-stat-label">Total Lunches Served</span>
              <div className="food-stat-value">
                {totalClaimed} <small>/ {totalEligible}</small>
              </div>
            </div>
          </div>
          <div className="food-progress-bar-bg">
            <div className="food-progress-bar-fill" style={{ width: `${overallPercent}%` }} />
          </div>
          <div className="food-stat-footer">
            <span>{overallPercent}% Distributed</span>
            <span>{summary.totalPending || 0} Remaining</span>
          </div>
        </div>

        {/* Veg Distribution Card */}
        <div className="food-stat-card food-stat-card--veg">
          <div className="food-stat-header">
            <div className="food-stat-icon-wrap food-stat-icon--veg">
              <Salad size={22} />
            </div>
            <div>
              <span className="food-stat-label">🥗 Vegetarian Served</span>
              <div className="food-stat-value text-emerald-400">
                {claimedVeg} <small>/ {totalVeg}</small>
              </div>
            </div>
          </div>
          <div className="food-progress-bar-bg">
            <div
              className="food-progress-bar-fill food-progress-bar-fill--veg"
              style={{ width: `${totalVeg > 0 ? Math.round((claimedVeg / totalVeg) * 100) : 0}%` }}
            />
          </div>
          <div className="food-stat-footer">
            <span className="text-emerald-400 font-semibold">{remainingVeg} Veg Left</span>
            <span>{totalVeg > 0 ? Math.round((claimedVeg / totalVeg) * 100) : 0}% Served</span>
          </div>
        </div>

        {/* Non-Veg Distribution Card */}
        <div className="food-stat-card food-stat-card--nonveg">
          <div className="food-stat-header">
            <div className="food-stat-icon-wrap food-stat-icon--nonveg">
              <Flame size={22} />
            </div>
            <div>
              <span className="food-stat-label">🍗 Non-Veg Served</span>
              <div className="food-stat-value text-amber-400">
                {claimedNonVeg} <small>/ {totalNonVeg}</small>
              </div>
            </div>
          </div>
          <div className="food-progress-bar-bg">
            <div
              className="food-progress-bar-fill food-progress-bar-fill--nonveg"
              style={{ width: `${totalNonVeg > 0 ? Math.round((claimedNonVeg / totalNonVeg) * 100) : 0}%` }}
            />
          </div>
          <div className="food-stat-footer">
            <span className="text-amber-400 font-semibold">{remainingNonVeg} Non-Veg Left</span>
            <span>{totalNonVeg > 0 ? Math.round((claimedNonVeg / totalNonVeg) * 100) : 0}% Served</span>
          </div>
        </div>
      </div>

      {/* ── SCANNER & INPUT SECTION ── */}
      <div className="food-scanner-main-card">
        <div className="food-scanner-header-row">
          <div className="food-scanner-title">
            <Utensils size={20} className="text-cyan-400" />
            <h2>Boarding Pass Food Scanner</h2>
          </div>
          <div className="food-scanner-controls">
            <button
              type="button"
              className={`food-ctrl-btn ${audioEnabled ? 'active' : ''}`}
              onClick={() => setAudioEnabled(!audioEnabled)}
              title={audioEnabled ? 'Sound alerts enabled' : 'Sound alerts muted'}
            >
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="hide-mobile">{audioEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
            <button
              type="button"
              className="food-ctrl-btn"
              onClick={loadSummary}
              title="Refresh live counts"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Camera Scanner Container */}
        {cameraOpen && (
          <div className="food-camera-viewfinder-wrap">
            <div id="food-qr-reader" className="food-qr-box" />
            <div className="food-viewfinder-overlay">
              <div className="food-scan-laser" />
              <p>Align Boarding Pass QR inside frame</p>
            </div>
            <button
              type="button"
              className="food-camera-close-btn"
              onClick={() => setCameraOpen(false)}
            >
              <CameraOff size={16} /> Stop Camera
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          className="food-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            claimFood(queryId);
          }}
        >
          <div className="food-input-wrap">
            <Search size={18} className="food-input-icon" />
            <input
              type="text"
              placeholder="Scan QR or enter Registration ID / Phone / Email..."
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              autoFocus
              className="food-search-input"
            />
          </div>
          <div className="food-btn-group">
            <button
              type="button"
              className={`food-action-btn food-action-btn--camera ${cameraOpen ? 'active' : ''}`}
              onClick={() => setCameraOpen(!cameraOpen)}
            >
              {cameraOpen ? <CameraOff size={18} /> : <Camera size={18} />}
              <span>{cameraOpen ? 'Close Cam' : 'Scan QR'}</span>
            </button>
            <button
              type="submit"
              disabled={!queryId.trim() || isProcessing}
              className="food-action-btn food-action-btn--claim"
            >
              <CheckCircle2 size={18} />
              <span>{isProcessing ? 'Verifying...' : 'Verify & Give Food'}</span>
            </button>
          </div>
        </form>

        {/* ── VERIFICATION RESULT DISPLAY ── */}
        {result && (
          <div
            className={`food-result-card food-result-card--${
              result.type === 'success'
                ? 'success'
                : result.type === 'already-claimed'
                ? 'duplicate'
                : 'error'
            }`}
          >
            {/* Header / Big Banner */}
            <div className="food-result-top">
              <div className="food-result-badge-icon">
                {result.type === 'success' && <CheckCircle2 size={36} />}
                {result.type === 'already-claimed' && <ShieldAlert size={36} />}
                {result.type === 'error' && <XCircle size={36} />}
              </div>
              <div className="food-result-title-group">
                <h3>{result.title}</h3>
                <p>{result.message}</p>
              </div>
            </div>

            {/* Food Preference Spotlight Banner */}
            {result.registration && (
              <div
                className={`food-pref-spotlight ${
                  (result.foodPreference || '').toLowerCase().includes('non')
                    ? 'food-pref-spotlight--nonveg'
                    : 'food-pref-spotlight--veg'
                }`}
              >
                <div className="food-pref-spotlight-icon">
                  {(result.foodPreference || '').toLowerCase().includes('non') ? (
                    <Flame size={32} />
                  ) : (
                    <Salad size={32} />
                  )}
                </div>
                <div className="food-pref-spotlight-text">
                  <span className="food-pref-label">MEAL PREFERENCE:</span>
                  <span className="food-pref-name">
                    {(result.foodPreference || 'VEG').toUpperCase()}
                  </span>
                </div>
                {result.type === 'already-claimed' && (
                  <div className="food-strict-locked-badge">
                    <Lock size={16} /> STRICTLY LOCKED
                  </div>
                )}
              </div>
            )}

            {/* Participant Details Block */}
            {result.registration && (
              <div className="food-result-details-grid">
                <div className="food-detail-item">
                  <User size={15} />
                  <span>Participant:</span>
                  <strong>{result.registration?.participant?.name || '—'}</strong>
                </div>
                <div className="food-detail-item">
                  <Building size={15} />
                  <span>College:</span>
                  <strong>{result.registration?.participant?.college || '—'}</strong>
                </div>
                <div className="food-detail-item">
                  <Sparkles size={15} />
                  <span>Reg ID:</span>
                  <code>{result.registration?.registrationId || '—'}</code>
                </div>
                <div className="food-detail-item">
                  <Clock size={15} />
                  <span>
                    {result.type === 'already-claimed' ? 'Originally Claimed At:' : 'Claimed At:'}
                  </span>
                  <strong>
                    {result.foodClaimedAt
                      ? new Date(result.foodClaimedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Just now'}
                  </strong>
                </div>
              </div>
            )}

            {result.type === 'already-claimed' && (
              <div className="food-warning-box">
                <AlertTriangle size={18} />
                <span>
                  <strong>Strict Security Alert:</strong> Meal has already been disbursed. Once marked,
                  food allocation cannot be reset or redistributed.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LIVE RECENT DISTRIBUTION FEED ── */}
      <div className="food-recent-section">
        <div className="food-recent-header">
          <div className="food-recent-title">
            <Clock size={18} className="text-cyan-400" />
            <h3>Recent Food Distributions ({filteredRecentClaims.length})</h3>
          </div>
          <div className="food-filter-pills">
            <button
              type="button"
              className={`food-filter-pill ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All ({summary.recentClaims?.length || 0})
            </button>
            <button
              type="button"
              className={`food-filter-pill food-filter-pill--veg ${filterType === 'veg' ? 'active' : ''}`}
              onClick={() => setFilterType('veg')}
            >
              🥗 Veg
            </button>
            <button
              type="button"
              className={`food-filter-pill food-filter-pill--nonveg ${filterType === 'non-veg' ? 'active' : ''}`}
              onClick={() => setFilterType('non-veg')}
            >
              🍗 Non-Veg
            </button>
          </div>
        </div>

        {/* Live List */}
        <div className="food-claims-list">
          {filteredRecentClaims.length === 0 ? (
            <div className="food-empty-state">
              <Utensils size={36} />
              <p>No food distributions recorded yet. Scan a boarding pass to start.</p>
            </div>
          ) : (
            filteredRecentClaims.map((item, idx) => {
              const p = item.participant || {};
              const pref = (item.foodPreference || p.foodPreference || 'Veg').toLowerCase();
              const isNonVeg = pref.includes('non');
              const timeStr = item.foodClaimedAt
                ? new Date(item.foodClaimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recent';

              return (
                <div key={item.registrationId || idx} className="food-claim-row">
                  <div className="food-claim-left">
                    <span className="food-claim-index">#{idx + 1}</span>
                    <div
                      className={`food-claim-badge ${
                        isNonVeg ? 'food-claim-badge--nonveg' : 'food-claim-badge--veg'
                      }`}
                    >
                      {isNonVeg ? <Flame size={14} /> : <Salad size={14} />}
                      <span>{isNonVeg ? 'Non-Veg' : 'Veg'}</span>
                    </div>
                    <div className="food-claim-info">
                      <strong>{p.name || item.registrationId}</strong>
                      <small>{p.college || 'Participant'} • {item.registrationId}</small>
                    </div>
                  </div>
                  <div className="food-claim-right">
                    <span className="food-claim-time">
                      <Clock size={12} /> {timeStr}
                    </span>
                    <span className="food-claim-status-tag">
                      <CheckCircle2 size={13} /> Served
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── VERIFIED FOOD CLAIM MODAL POPUP ── */}
      {verifiedModalData && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            setVerifiedModalData(null);
            setResult(null);
          }}
        >
          <div
            className="verified-checkin-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', border: verifiedModalData.status === 'claimed' ? '1px solid rgba(74, 222, 128, 0.4)' : verifiedModalData.status === 'already-claimed' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #334155' }}
          >
            {/* Modal Badges */}
            <div className="verified-modal-badges">
              {verifiedModalData.status === 'claimed' && (
                <>
                  <span className="badge-authentic">✓ VERIFIED PASS</span>
                  <span className={`badge-verified ${verifiedModalData.foodPreference === 'Non-Veg' ? 'badge-verified--nonveg' : ''}`} style={verifiedModalData.foodPreference === 'Non-Veg' ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' } : undefined}>
                    {verifiedModalData.foodPreference === 'Non-Veg' ? '🍗 NON-VEG MEAL' : '🥗 VEG MEAL'}
                  </span>
                </>
              )}
              {verifiedModalData.status === 'already-claimed' && (
                <>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '4px 12px', borderRadius: '999px', letterSpacing: '0.5px' }}>
                    ⛔ DUPLICATE ATTEMPT
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '4px 12px', borderRadius: '999px' }}>
                    LOCKED
                  </span>
                </>
              )}
              {verifiedModalData.status === 'error' && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '4px 12px', borderRadius: '999px' }}>
                  NOT ELIGIBLE
                </span>
              )}
            </div>

            {/* Passenger Name & Institution */}
            <div className="verified-modal-passenger">
              <span className="verified-label">PARTICIPANT NAME</span>
              <h2>{verifiedModalData.registration?.participant?.name || 'Participant'}</h2>
              <span className="verified-college">{verifiedModalData.registration?.participant?.college || 'Institution'}</span>
            </div>

            {/* GIANT MEAL SPOTLIGHT CARD */}
            {verifiedModalData.foodPreference && (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: verifiedModalData.foodPreference === 'Non-Veg'
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(220, 38, 38, 0.18))'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.18))',
                  border: verifiedModalData.foodPreference === 'Non-Veg'
                    ? '2px solid rgba(245, 158, 11, 0.6)'
                    : '2px solid rgba(16, 185, 129, 0.6)',
                  boxShadow: verifiedModalData.foodPreference === 'Non-Veg'
                    ? '0 0 30px rgba(245, 158, 11, 0.25)'
                    : '0 0 30px rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ fontSize: '2.5rem' }}>
                  {verifiedModalData.foodPreference === 'Non-Veg' ? '🍗' : '🥗'}
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: verifiedModalData.foodPreference === 'Non-Veg' ? '#f59e0b' : '#34d399' }}>
                    MEAL ALLOCATION
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                    {verifiedModalData.foodPreference === 'Non-Veg' ? 'NON-VEGETARIAN' : 'VEGETARIAN'} LUNCH
                  </div>
                  <small style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                    {verifiedModalData.status === 'claimed' ? 'Please hand over the lunch pack.' : 'Previous claim recorded.'}
                  </small>
                </div>
              </div>
            )}

            {/* Registration Details Grid */}
            <div className="verified-modal-grid2">
              <div className="verified-info-box">
                <span className="verified-label">REGISTRATION ID</span>
                <strong className="reg-id-val">{verifiedModalData.registration?.registrationId || 'N/A'}</strong>
              </div>
              <div className="verified-info-box">
                <span className="verified-label">CLAIM TIMESTAMP</span>
                <strong className="date-val" style={{ fontSize: '12px' }}>
                  {verifiedModalData.foodClaimedAt
                    ? new Date(verifiedModalData.foodClaimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </strong>
              </div>
            </div>

            {/* Status Banner */}
            {verifiedModalData.status === 'claimed' && (
              <div className="verified-status-banner">
                <div className="status-check-title">✅ Food Allocation Confirmed</div>
                <div className="status-check-time">
                  Recorded in database by {verifiedModalData.foodClaimedBy || 'Volunteer'}.
                </div>
              </div>
            )}

            {verifiedModalData.status === 'already-claimed' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={16} /> Already Claimed Earlier!
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px' }}>
                  Originally received at {verifiedModalData.foodClaimedAt ? new Date(verifiedModalData.foodClaimedAt).toLocaleTimeString() : 'Earlier'} by {verifiedModalData.foodClaimedBy || 'Desk'}.
                </div>
              </div>
            )}

            {verifiedModalData.status === 'error' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f87171' }}>
                  {verifiedModalData.title || 'Verification Issue'}
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px' }}>
                  {verifiedModalData.message || 'Send participant to Help / Verification Desk.'}
                </div>
              </div>
            )}

            {/* PRIMARY ACTION: PROCEED & SCAN NEXT */}
            <button
              type="button"
              className="continue-scanning-btn"
              onClick={() => {
                setVerifiedModalData(null);
                setResult(null);
                setQueryId('');
                setCameraOpen(true); // RE-OPENS CAMERA INSTANTLY!
              }}
              style={{
                background: verifiedModalData.status === 'claimed'
                  ? (verifiedModalData.foodPreference === 'Non-Veg' ? '#d97706' : '#059669')
                  : '#2563eb',
                padding: '16px',
                fontSize: '16px',
                letterSpacing: '0.5px',
              }}
            >
              PROCEED &amp; SCAN NEXT PASS →
            </button>

            <button
              type="button"
              onClick={() => {
                setVerifiedModalData(null);
                setResult(null);
                setQueryId('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '4px',
                textDecoration: 'underline',
              }}
            >
              Close &amp; View Summary Feed
            </button>

            <div className="verified-modal-footer">Noctivus '26 • Food Distribution Operations</div>
          </div>
        </div>
      )}
    </div>
  );
}
