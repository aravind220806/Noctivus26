import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';

export function AttendanceTab({ authHeaders }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventsList, setEventsList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Scanner & Lookup state
  const [scanInput, setScanInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeRegistration, setActiveRegistration] = useState(null);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const scannerRef = useRef(null);
  const audioContextRef = useRef(null);
  const scanInputRef = useRef(null);

  // Play a pleasant high-frequency confirmation beep on successful scan
  const playBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio not supported or blocked
    }
  };

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast((prev) => (prev === msg ? null : prev));
    }, 3500);
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
      // ignore URL parse errors
    }
    if (trimmed.includes('/')) {
      const segments = trimmed.split('/').filter(Boolean);
      return segments[segments.length - 1] || trimmed;
    }
    return trimmed;
  };

  // Load summary and event list
  const loadSummary = async () => {
    try {
      const response = await adminFetch(apiPath('/api/admin/attendance/summary'), { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
        if (data.events && data.events.length) {
          setEventsList(data.events);
        }
      }
    } catch (err) {
      console.error('Failed to load attendance summary:', err);
    }
  };

  // Load roster list for table
  const loadRoster = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEventId) params.set('eventId', selectedEventId);
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter) params.set('status', statusFilter);

      const response = await adminFetch(apiPath(`/api/admin/attendance/list?${params.toString()}`), {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setRegistrations(data.registrations || []);
      }
    } catch (err) {
      console.error('Failed to load attendance roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadRoster();
  }, [selectedEventId, statusFilter]);

  // Camera QR Scanner hook
  useEffect(() => {
    if (!cameraOpen) return undefined;
    let active = true;
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        if (!active) return;
        const scanner = new Html5Qrcode('attendance-qr-reader');
        scannerRef.current = scanner;
        return scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 220, height: 220 } },
          (scannedVal) => {
            const clean = extractCleanId(scannedVal);
            setScanInput(clean);
            setCameraOpen(false);
            playBeep();
            handleLookup(clean);
          },
          () => {}
        );
      })
      .catch((error) => {
        setMessage(
          error?.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access or enter ID manually.'
            : 'Camera could not start. Use HTTPS or enter ID manually.'
        );
      });

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

  const handleLookup = async (queryToSearch) => {
    const clean = extractCleanId(queryToSearch || scanInput);
    if (!clean) return;
    setMessage('');
    try {
      const response = await adminFetch(apiPath(`/api/admin/attendance/lookup/${encodeURIComponent(clean)}`), {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        const reg = data.registration;
        // Mark locked state for any member who was already present
        if (reg?.eventAttendanceList) {
          reg.eventAttendanceList = reg.eventAttendanceList.map((ev) => ({
            ...ev,
            members: (ev.members || []).map((m) => ({
              ...m,
              locked: Boolean(m.present || m.locked),
            })),
          }));
        }
        setActiveRegistration(reg);

        // Automatically focus on selected event tab if available
        if (selectedEventId && reg?.eventAttendanceList) {
          const idx = reg.eventAttendanceList.findIndex((e) => e.eventId === selectedEventId);
          if (idx !== -1) setActiveEventIndex(idx);
          else setActiveEventIndex(0);
        } else {
          setActiveEventIndex(0);
        }
      } else {
        const err = await response.json().catch(() => ({}));
        setMessage(err.detail || 'Registration or Boarding Pass not found.');
        setActiveRegistration(null);
      }
    } catch {
      setMessage('Lookup failed. Check connection.');
    }
  };

  // Toggle member attendance — locked members who are already present cannot be un-ticked
  const handleMemberToggle = (eventIdx, memberName) => {
    if (!activeRegistration) return;
    setActiveRegistration((prev) => {
      if (!prev) return prev;
      const updatedEventList = [...prev.eventAttendanceList];
      const ev = { ...updatedEventList[eventIdx] };
      ev.members = ev.members.map((m) => {
        if (m.name === memberName) {
          // If already marked present and saved/locked, cannot be changed back to absent
          if (m.locked || m.present) {
            return m;
          }
          return { ...m, present: !m.present };
        }
        return m;
      });
      const presentCount = ev.members.filter((m) => m.present).length;
      ev.presentCount = presentCount;
      ev.allPresent = presentCount === ev.totalCount && ev.totalCount > 0;
      ev.isPartial = presentCount > 0 && presentCount < ev.totalCount;
      ev.isAbsent = presentCount === 0;
      ev.attended = presentCount > 0;
      updatedEventList[eventIdx] = ev;
      return { ...prev, eventAttendanceList: updatedEventList };
    });
  };

  // Mark all members present in the event tab
  const handleSelectAllMembers = (eventIdx) => {
    if (!activeRegistration) return;
    setActiveRegistration((prev) => {
      if (!prev) return prev;
      const updatedEventList = [...prev.eventAttendanceList];
      const ev = { ...updatedEventList[eventIdx] };
      ev.members = ev.members.map((m) => ({
        ...m,
        present: true,
      }));
      const presentCount = ev.members.length;
      ev.presentCount = presentCount;
      ev.allPresent = ev.totalCount > 0;
      ev.isPartial = false;
      ev.isAbsent = false;
      ev.attended = true;
      updatedEventList[eventIdx] = ev;
      return { ...prev, eventAttendanceList: updatedEventList };
    });
  };

  // Save Attendance and immediately CLOSE popup so coordinator continues scanning
  const handleSaveAttendance = async (eventIdx, forceAllPresent = false) => {
    if (!activeRegistration) return;
    const targetEv = activeRegistration.eventAttendanceList?.[eventIdx];
    if (!targetEv) return;

    let membersToSave = targetEv.members;
    if (forceAllPresent) {
      membersToSave = membersToSave.map((m) => ({ ...m, present: true }));
    }

    setSavingAttendance(true);
    try {
      const payload = {
        registrationId: activeRegistration.registrationId,
        eventId: targetEv.eventId,
        members: membersToSave,
        notes: '',
      };
      const response = await adminFetch(apiPath('/api/admin/attendance/mark'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const savedCount = membersToSave.filter((m) => m.present).length;
        showToast(`✓ Attendance recorded for ${targetEv.eventName} (${savedCount}/${targetEv.totalCount} present). Ready for next scan!`);
        // Immediately close popup and reset scanner input for instant next scan
        setActiveRegistration(null);
        setScanInput('');
        loadSummary();
        loadRoster();
        // Focus back to input
        setTimeout(() => {
          scanInputRef.current?.focus();
        }, 150);
      } else {
        const err = await response.json().catch(() => ({}));
        setMessage(err.detail || 'Failed to save attendance.');
      }
    } catch {
      setMessage('Network error while saving attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleDownloadExcel = async () => {
    setExporting(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/attendance/export-excel'), {
        headers: authHeaders,
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'noctivus_event_wise_attendance.xlsx';
        link.click();
        URL.revokeObjectURL(url);
      } else {
        setMessage('Failed to download Excel file.');
      }
    } catch {
      setMessage('Download error.');
    } finally {
      setExporting(false);
    }
  };

  const currentEventStats = selectedEventId
    ? summary?.events?.find((e) => e.eventId === selectedEventId)
    : null;

  return (
    <div className="admin-attendance-container">
      {/* ─── Success Floating Toast ─────────────────────────────────────── */}
      {successToast && (
        <div className="attendance-success-toast" role="alert">
          <Icon name="check" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ─── Top Control Header ────────────────────────────────────────── */}
      <div className="attendance-header-panel">
        <div className="attendance-header-info">
          <div className="attendance-title-row">
            <h2>Event Attendance & E-Certificate Tracker</h2>
            <span className="badge-live-pulse">LIVE SCANNER</span>
          </div>
          <p className="attendance-subtitle">
            Scan participant boarding pass QR codes, mark attending team members event-wise, and export Excel sheets for E-Certificate issuance.
          </p>
        </div>

        <div className="attendance-header-actions">
          <div className="event-dropdown-wrapper">
            <label htmlFor="event-filter-select">Event Scope:</label>
            <select
              id="event-filter-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">All Events ({eventsList.length})</option>
              {eventsList.map((ev) => (
                <option key={ev.eventId} value={ev.eventId}>
                  {ev.eventName} ({ev.presentMembers}/{ev.totalMembers} Present)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="button button-primary export-excel-btn"
            onClick={handleDownloadExcel}
            disabled={exporting}
          >
            <Icon name="external" />
            <span>{exporting ? 'Generating...' : 'Export Attendance (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* ─── Metric Summary Cards ──────────────────────────────────────── */}
      <div className="attendance-stats-grid">
        <div className="att-stat-card">
          <span className="stat-label">{selectedEventId ? 'Event Teams' : 'Total Teams'}</span>
          <strong className="stat-value">{currentEventStats ? currentEventStats.totalTeams : (summary?.totalTeams ?? '—')}</strong>
          <span className="stat-hint">Confirmed Registrations</span>
        </div>

        <div className="att-stat-card">
          <span className="stat-label">Total Expected Members</span>
          <strong className="stat-value">{currentEventStats ? currentEventStats.totalMembers : (summary?.totalMembers ?? '—')}</strong>
          <span className="stat-hint">Across all team rosters</span>
        </div>

        <div className="att-stat-card stat-card-highlight">
          <span className="stat-label">Present Members</span>
          <strong className="stat-value stat-val-present">{currentEventStats ? currentEventStats.presentMembers : (summary?.totalPresent ?? '—')}</strong>
          <span className="stat-hint">✓ Verified in Event</span>
        </div>

        <div className="att-stat-card">
          <span className="stat-label">Absent / Pending</span>
          <strong className="stat-value stat-val-absent">{currentEventStats ? currentEventStats.absentMembers : (summary?.totalAbsent ?? '—')}</strong>
          <span className="stat-hint">Not yet marked present</span>
        </div>

        <div className="att-stat-card">
          <span className="stat-label">Attendance Rate</span>
          <strong className="stat-value">{currentEventStats ? `${currentEventStats.attendanceRate}%` : `${summary?.overallAttendanceRate ?? 0}%`}</strong>
          <span className="stat-hint">Turnout percentage</span>
        </div>
      </div>

      {/* ─── Scanner & Search Section ──────────────────────────────────── */}
      <div className="attendance-scan-bar-card">
        <div className="attendance-scanner-header">
          <div className="scanner-header-left">
            <div className="scanner-icon-badge">
              <Icon name="scan" />
            </div>
            <div>
              <h3>Scan Boarding Pass QR Code</h3>
              <p className="text-muted">Use the live camera scanner or enter Registration ID / Reference to pull up the participant's event team.</p>
            </div>
          </div>

          <button
            type="button"
            className={`button ${cameraOpen ? 'button-danger' : 'button-primary'} camera-toggle-btn`}
            onClick={() => setCameraOpen((prev) => !prev)}
          >
            <Icon name="scan" />
            <span>{cameraOpen ? 'Stop Camera' : 'Start Camera Scanner'}</span>
          </button>
        </div>

        {/* Camera Viewport (Responsive for Mobile & Desktop) */}
        {cameraOpen && (
          <div className="camera-viewport-card">
            <div id="attendance-qr-reader" className="camera-qr-viewport" />
            <p className="camera-hint">Point camera steadily at the Boarding Pass QR Code</p>
          </div>
        )}

        {/* Search / Manual Input Bar */}
        <div className="attendance-search-row">
          <div className="scan-input-wrapper">
            <input
              ref={scanInputRef}
              type="text"
              className="scan-input-field"
              placeholder="Enter Registration ID (e.g. NOC26-...) or URL..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLookup();
              }}
            />
            <button
              type="button"
              className="button button-primary lookup-btn"
              onClick={() => handleLookup()}
            >
              Lookup Boarding Pass
            </button>
          </div>
        </div>

        {message && <div className="admin-message error-banner">{message}</div>}
      </div>

      {/* ─── Scanned Boarding Pass Modal Popup (Mobile & Desktop) ────────── */}
      {activeRegistration && (
        <div className="attendance-modal-backdrop" onClick={() => setActiveRegistration(null)}>
          <div className="attendance-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="attendance-modal-header">
              <div className="modal-header-info">
                <span className="modal-reg-id">{activeRegistration.registrationId}</span>
                <h3>{activeRegistration.participant?.name || 'Participant'}</h3>
                <span className="modal-college-tag">{activeRegistration.participant?.college || 'College N/A'}</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveRegistration(null)}
                aria-label="Close Popup"
              >
                &times;
              </button>
            </div>

            {/* Event Tabs inside Modal */}
            <div className="modal-event-tabs">
              {activeRegistration.eventAttendanceList?.map((ev, idx) => (
                <button
                  key={ev.eventId}
                  className={`modal-tab-btn ${activeEventIndex === idx ? 'active' : ''}`}
                  onClick={() => setActiveEventIndex(idx)}
                >
                  <span className="tab-name">{ev.eventName}</span>
                  <span className="tab-pill-count">
                    {ev.presentCount}/{ev.totalCount} Present
                  </span>
                </button>
              ))}
            </div>

            {/* Active Event Members Checklist */}
            {(() => {
              const currentEv = activeRegistration.eventAttendanceList?.[activeEventIndex];
              if (!currentEv) return <p className="text-muted" style={{ padding: '20px' }}>No event data available.</p>;

              const hasUnmarkedMembers = currentEv.members?.some((m) => !m.present);

              return (
                <div className="modal-event-body">
                  <div className="modal-event-meta-strip">
                    <div>
                      <strong>Category:</strong> {currentEv.category?.toUpperCase()}
                    </div>
                    <div>
                      <strong>Roster:</strong> {currentEv.presentCount} of {currentEv.totalCount} marked Present
                    </div>
                  </div>

                  <div className="modal-lock-notice">
                    <span className="lock-icon">🔒</span>
                    <span><strong>Attendance Rule:</strong> Once a member is marked as present, their attendance is locked and cannot be changed.</span>
                  </div>

                  <div className="modal-members-list">
                    {currentEv.members?.map((m) => {
                      const isLocked = Boolean(m.locked || m.present);
                      return (
                        <label
                          key={m.name}
                          className={`modal-member-item ${m.present ? 'is-present' : 'is-absent'} ${isLocked ? 'is-locked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(m.present)}
                            disabled={isLocked}
                            onChange={() => handleMemberToggle(activeEventIndex, m.name)}
                          />
                          <div className="modal-member-info">
                            <span className="modal-member-name">
                              {m.name} {m.isLeader && <span className="leader-badge">Team Leader</span>}
                            </span>
                            {m.rollNo && <span className="modal-member-roll">Roll No: {m.rollNo}</span>}
                          </div>

                          <div className="modal-member-badge-wrap">
                            {isLocked ? (
                              <span className="badge-present-locked">
                                ✓ PRESENT (LOCKED)
                              </span>
                            ) : m.present ? (
                              <span className="badge-present-selected">
                                ✓ PRESENT
                              </span>
                            ) : (
                              <span className="badge-absent-pending">
                                ABSENT
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Modal Action Buttons Footer */}
                  <div className="modal-actions-footer">
                    {hasUnmarkedMembers && (
                      <button
                        type="button"
                        className="button button-outline mark-all-btn"
                        onClick={() => handleSelectAllMembers(activeEventIndex)}
                      >
                        Select All Remaining
                      </button>
                    )}

                    <button
                      type="button"
                      className="button button-primary save-close-btn"
                      onClick={() => handleSaveAttendance(activeEventIndex, false)}
                      disabled={savingAttendance}
                    >
                      {savingAttendance ? 'Saving Attendance...' : `Save Attendance (${currentEv.presentCount}/${currentEv.totalCount}) & Close`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Attendance Roster Table ───────────────────────────────────── */}
      <div className="admin-panel attendance-roster-panel">
        <div className="roster-header-row">
          <div>
            <h3>Participant Roster & E-Certificate Status</h3>
            <p className="text-muted">Live view of teams and members for {selectedEventId ? eventsList.find((e) => e.eventId === selectedEventId)?.eventName || selectedEventId : 'All Events'}</p>
          </div>

          <div className="roster-filters-group">
            <input
              type="text"
              placeholder="Filter by name, college, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="roster-search-input"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="roster-status-select"
            >
              <option value="">All Statuses</option>
              <option value="present">All Members Present</option>
              <option value="partial">Partial Attendance</option>
              <option value="absent">All Absent</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="attendance-loading-state">
            <p>Loading attendance records...</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="attendance-empty-state">
            <p>No confirmed registrations match the selected filters.</p>
          </div>
        ) : (
          <div className="attendance-table-container">
            <table className="admin-table attendance-table">
              <thead>
                <tr>
                  <th>REG ID</th>
                  <th>PARTICIPANT / TEAM LEADER</th>
                  <th>COLLEGE</th>
                  <th>REGISTERED EVENTS</th>
                  <th>MEMBERS ATTENDANCE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => {
                  const evList = r.eventAttendanceList || [];
                  const targetEv = selectedEventId
                    ? evList.find((e) => e.eventId === selectedEventId) || evList[0]
                    : evList[0];

                  return (
                    <tr key={r.registrationId}>
                      <td className="font-mono font-bold text-sky">{r.registrationId}</td>
                      <td>
                        <div className="roster-name-cell">
                          <strong>{r.participant?.name || 'Participant'}</strong>
                          <span className="text-muted text-xs">{r.participant?.phone || 'No Phone'} • {r.participant?.email}</span>
                        </div>
                      </td>
                      <td className="text-xs text-muted max-w-xs">{r.participant?.college || '—'}</td>
                      <td>
                        <div className="roster-events-cell">
                          {evList.map((e) => (
                            <span
                              key={e.eventId}
                              className={`event-chip ${e.allPresent ? 'chip-all-present' : e.isPartial ? 'chip-partial' : 'chip-absent'}`}
                            >
                              {e.eventName}: {e.presentCount}/{e.totalCount}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {targetEv ? (
                          <div className="roster-members-pills">
                            {targetEv.members?.map((m) => (
                              <span
                                key={m.name}
                                className={`member-pill-mini ${m.present ? 'pill-pres' : 'pill-abs'}`}
                                title={`${m.name} (${m.role}): ${m.present ? 'Present' : 'Absent'}`}
                              >
                                {m.present ? '✓' : '✗'} {m.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">No event data</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-sm button-primary"
                          onClick={() => {
                            setActiveRegistration(r);
                            if (selectedEventId && r.eventAttendanceList) {
                              const idx = r.eventAttendanceList.findIndex((e) => e.eventId === selectedEventId);
                              if (idx !== -1) setActiveEventIndex(idx);
                              else setActiveEventIndex(0);
                            } else {
                              setActiveEventIndex(0);
                            }
                          }}
                        >
                          Mark / Check
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
