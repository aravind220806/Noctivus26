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

  // Scanner & Lookup state
  const [scanInput, setScanInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeRegistration, setActiveRegistration] = useState(null);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const scannerRef = useRef(null);
  const audioContextRef = useRef(null);

  // Play a pleasant high-frequency beep on successful scan
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
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio not supported or blocked
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
          if (!selectedEventId && data.events[0]) {
            // Keep default empty for "All Events" or select first
          }
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
          { fps: 10, qrbox: { width: 220, height: 220 } },
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
    setSaveSuccess(false);
    try {
      const response = await adminFetch(apiPath(`/api/admin/attendance/lookup/${encodeURIComponent(clean)}`), {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setActiveRegistration(data.registration);
        // Automatically focus on the selected event if present in registration
        if (selectedEventId && data.registration?.eventAttendanceList) {
          const idx = data.registration.eventAttendanceList.findIndex((e) => e.eventId === selectedEventId);
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

  const handleMemberToggle = (eventIdx, memberName) => {
    if (!activeRegistration) return;
    setActiveRegistration((prev) => {
      if (!prev) return prev;
      const updatedEventList = [...prev.eventAttendanceList];
      const ev = { ...updatedEventList[eventIdx] };
      ev.members = ev.members.map((m) => {
        if (m.name === memberName) {
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

  const handleSelectAllMembers = (eventIdx, setPresent) => {
    if (!activeRegistration) return;
    setActiveRegistration((prev) => {
      if (!prev) return prev;
      const updatedEventList = [...prev.eventAttendanceList];
      const ev = { ...updatedEventList[eventIdx] };
      ev.members = ev.members.map((m) => ({ ...m, present: setPresent }));
      const presentCount = setPresent ? ev.members.length : 0;
      ev.presentCount = presentCount;
      ev.allPresent = setPresent && ev.totalCount > 0;
      ev.isPartial = false;
      ev.isAbsent = !setPresent;
      ev.attended = setPresent;
      updatedEventList[eventIdx] = ev;
      return { ...prev, eventAttendanceList: updatedEventList };
    });
  };

  const handleSaveAttendance = async (eventIdx) => {
    if (!activeRegistration) return;
    const targetEv = activeRegistration.eventAttendanceList[eventIdx];
    if (!targetEv) return;

    setSavingAttendance(true);
    setSaveSuccess(false);
    try {
      const payload = {
        registrationId: activeRegistration.registrationId,
        eventId: targetEv.eventId,
        members: targetEv.members,
        notes: '',
      };
      const response = await adminFetch(apiPath('/api/admin/attendance/mark'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        setActiveRegistration(data.registration);
        setSaveSuccess(true);
        loadSummary();
        loadRoster();
        setTimeout(() => setSaveSuccess(false), 4000);
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

  const handleQuickToggleInRoster = async (regId, eventId, memberName, currentPresent) => {
    try {
      const response = await adminFetch(apiPath('/api/admin/attendance/quick-toggle'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: regId,
          eventId,
          memberName,
          present: !currentPresent,
        }),
      });
      if (response.ok) {
        loadSummary();
        loadRoster();
        if (activeRegistration && activeRegistration.registrationId === regId) {
          const data = await response.json();
          setActiveRegistration(data.registration);
        }
      }
    } catch (err) {
      console.error('Quick toggle failed:', err);
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
      {/* ─── Top Control Bar ────────────────────────────────────────── */}
      <div className="attendance-header-panel">
        <div className="attendance-header-info">
          <div className="attendance-title-row">
            <h2>Event Attendance & E-Certificate Tracker</h2>
            <span className="badge-live-pulse">LIVE TRACKER</span>
          </div>
          <p className="attendance-subtitle">
            Scan participant boarding pass QR codes, tick attending team members event-wise, and export clean Excel sheets for E-Certificate generation.
          </p>
        </div>

        <div className="attendance-header-actions">
          <div className="event-dropdown-wrapper">
            <label htmlFor="event-filter-select">Selected Event:</label>
            <select
              id="event-filter-select"
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
              }}
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
            className="button button-primary export-excel-btn"
            onClick={handleDownloadExcel}
            disabled={exporting}
            title="Download full multi-sheet Excel file with an individual sheet for every event"
          >
            {exporting ? (
              <>
                <span className="spinner-dots" /> Generating Excel...
              </>
            ) : (
              <>
                <Icon name="external" /> Download Event-Wise Excel (.xlsx)
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Summary Metric Cards ───────────────────────────────────── */}
      <div className="attendance-stats-grid">
        <div className="att-stat-card">
          <div className="att-stat-label">Total Registrations</div>
          <div className="att-stat-value">
            {currentEventStats ? currentEventStats.totalTeams : summary?.totalRegistrations || 0}
          </div>
          <div className="att-stat-sub">
            {currentEventStats ? `${currentEventStats.teamsAttended} teams attended` : `${summary?.totalEvents || 0} Events`}
          </div>
        </div>

        <div className="att-stat-card">
          <div className="att-stat-label">Total Enrolled Members</div>
          <div className="att-stat-value text-sky">
            {currentEventStats ? currentEventStats.totalMembers : summary?.totalMembers || 0}
          </div>
          <div className="att-stat-sub">Leaders + Team Members</div>
        </div>

        <div className="att-stat-card highlight-green">
          <div className="att-stat-label">Present Members (E-Cert Ready)</div>
          <div className="att-stat-value text-green">
            {currentEventStats ? currentEventStats.presentMembers : summary?.totalPresentMembers || 0}
          </div>
          <div className="att-stat-sub">
            {currentEventStats ? `${currentEventStats.attendanceRate}% Attendance Rate` : `${summary?.overallAttendanceRate || 0}% Overall`}
          </div>
        </div>

        <div className="att-stat-card">
          <div className="att-stat-label">Absent / Pending</div>
          <div className="att-stat-value text-red">
            {currentEventStats ? currentEventStats.absentMembers : summary?.totalAbsentMembers || 0}
          </div>
          <div className="att-stat-sub">Not marked yet</div>
        </div>
      </div>

      {message && <div className="admin-message attendance-alert">{message}</div>}

      {/* ─── Scanner & Active Card Grid ────────────────────────────── */}
      <div className="attendance-scanner-grid">
        {/* Left Box: Scanner & Manual Lookup */}
        <div className="admin-panel attendance-lookup-card">
          <h3>
            <Icon name="search" /> Scan Boarding Pass / Search
          </h3>
          <p className="scanner-instruction">
            Use the camera to scan the attendee's Boarding Pass QR code, or enter the Registration ID (e.g. <code>NOC26-ABC123</code>), Phone, or Email.
          </p>

          <div className="scanner-input-row">
            <input
              type="text"
              placeholder="Scan or enter NOC26-XXXX / Email / Phone"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLookup();
              }}
            />
            <button className="button button-primary" onClick={() => handleLookup()}>
              Lookup
            </button>
            <button
              className={`button ${cameraOpen ? 'button-danger' : 'button-secondary'} camera-toggle-btn`}
              onClick={() => setCameraOpen((prev) => !prev)}
            >
              {cameraOpen ? 'Stop Camera' : 'Scan Camera'}
            </button>
          </div>

          {cameraOpen && (
            <div className="camera-viewfinder-container">
              <div id="attendance-qr-reader" className="camera-qr-viewport" />
              <p className="camera-hint">Point camera steadily at the Boarding Pass QR Code</p>
            </div>
          )}

          {/* Quick instructions / Help */}
          <div className="attendance-quick-tips">
            <strong>Coordinator Workflow:</strong>
            <ol>
              <li>Scan the participant's printed or mobile boarding pass.</li>
              <li>Tick each attending team member for the event.</li>
              <li>Click <em>Save Attendance</em> — live count updates immediately.</li>
            </ol>
          </div>
        </div>

        {/* Right Box: Scanned Member Attendance Card */}
        <div className="admin-panel attendance-active-panel">
          {activeRegistration ? (
            <div className="active-reg-wrapper">
              <div className="active-reg-header">
                <div className="active-reg-title">
                  <span className="active-reg-id">{activeRegistration.registrationId}</span>
                  <h4>{activeRegistration.participant?.name || 'Participant'}</h4>
                </div>
                <div className="active-reg-badges">
                  <span className={`status-badge status-${activeRegistration.paymentStatus}`}>
                    {activeRegistration.paymentStatus?.toUpperCase()}
                  </span>
                  {activeRegistration.checkedIn ? (
                    <span className="badge-gate-checkedin">Gate Check-in Done</span>
                  ) : (
                    <span className="badge-gate-pending">Gate Check-in Pending</span>
                  )}
                </div>
              </div>

              <div className="active-reg-meta">
                <div>
                  <strong>College:</strong> {activeRegistration.participant?.college || '—'}
                </div>
                <div>
                  <strong>Phone:</strong> {activeRegistration.participant?.phone || '—'}
                </div>
                <div>
                  <strong>Email:</strong> {activeRegistration.participant?.email || '—'}
                </div>
              </div>

              {/* Event Tabs if registered for multiple events */}
              <div className="active-reg-events-tabs">
                {activeRegistration.eventAttendanceList?.map((ev, idx) => (
                  <button
                    key={ev.eventId}
                    className={`event-tab-btn ${activeEventIndex === idx ? 'active' : ''}`}
                    onClick={() => setActiveEventIndex(idx)}
                  >
                    <span>{ev.eventName}</span>
                    <span className="tab-pill-count">
                      {ev.presentCount}/{ev.totalCount} Present
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Event Members Checklist */}
              {(() => {
                const currentEv = activeRegistration.eventAttendanceList?.[activeEventIndex];
                if (!currentEv) return <p>No event data available.</p>;

                return (
                  <div className="event-members-box">
                    <div className="members-box-header">
                      <div>
                        <h5>{currentEv.eventName}</h5>
                        <small className="text-muted">
                          Category: {currentEv.category?.toUpperCase()} • Team Size: {currentEv.teamSize || currentEv.totalCount}
                        </small>
                      </div>

                      <div className="members-quick-actions">
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => handleSelectAllMembers(activeEventIndex, true)}
                        >
                          Select All
                        </button>
                        <span className="divider">|</span>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => handleSelectAllMembers(activeEventIndex, false)}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="members-checklist">
                      {currentEv.members?.map((m) => (
                        <label
                          key={m.name}
                          className={`member-check-item ${m.present ? 'checked' : 'unchecked'}`}
                        >
                          <input
                            type="checkbox"
                            checked={m.present}
                            onChange={() => handleMemberToggle(activeEventIndex, m.name)}
                          />
                          <div className="member-info">
                            <span className="member-name">
                              {m.name} {m.isLeader && <span className="leader-pill">Leader</span>}
                            </span>
                            {m.rollNo && <span className="member-roll">Roll No: {m.rollNo}</span>}
                          </div>
                          <span className={`member-status-pill ${m.present ? 'pill-present' : 'pill-absent'}`}>
                            {m.present ? 'PRESENT' : 'ABSENT'}
                          </span>
                        </label>
                      ))}
                    </div>

                    {saveSuccess && (
                      <div className="save-success-banner">
                        <Icon name="check" /> Attendance saved successfully!
                      </div>
                    )}

                    <div className="members-save-footer">
                      <button
                        type="button"
                        className="button button-primary save-att-btn"
                        onClick={() => handleSaveAttendance(activeEventIndex)}
                        disabled={savingAttendance}
                      >
                        {savingAttendance ? 'Saving Attendance...' : `Save Attendance (${currentEv.presentCount}/${currentEv.totalCount} Present)`}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="empty-active-state">
              <div className="empty-icon-circle">
                <Icon name="search" />
              </div>
              <h4>No Boarding Pass Scanned</h4>
              <p>Scan a QR code or enter a Registration ID on the left to mark event attendance for participants and their teams.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Event Attendance Roster Table ───────────────────────────── */}
      <section className="admin-panel attendance-roster-panel">
        <div className="roster-panel-header">
          <div>
            <h3>
              {selectedEventId
                ? `${eventsList.find((e) => e.eventId === selectedEventId)?.eventName || selectedEventId} Roster`
                : 'All Registered Teams & Attendance Roster'}
            </h3>
            <p className="roster-sub">
              Showing {registrations.length} registration(s). You can toggle attendance directly from this table or click <strong>View & Edit</strong> to open the checklist.
            </p>
          </div>

          <div className="roster-filters-row">
            <input
              type="search"
              placeholder="Search by name, college, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadRoster();
              }}
            />

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="present">Fully Present</option>
              <option value="partial">Partially Present</option>
              <option value="absent">Absent</option>
            </select>

            <button className="button button-secondary" onClick={loadRoster} disabled={loading}>
              {loading ? 'Refreshing...' : 'Filter'}
            </button>
          </div>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table attendance-table">
            <thead>
              <tr>
                <th>Reg ID</th>
                <th>Participant / Leader</th>
                <th>College</th>
                <th>Registered Event(s)</th>
                <th>Members & Attendance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="admin-table-empty">
                    {loading ? 'Loading attendance roster...' : 'No registrations found matching criteria.'}
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => {
                  const evList = reg.eventAttendanceList || [];
                  const displayedEvents = selectedEventId
                    ? evList.filter((e) => e.eventId === selectedEventId)
                    : evList;

                  return (
                    <tr key={reg.registrationId} className="attendance-row">
                      <td className="font-mono">{reg.registrationId}</td>
                      <td>
                        <strong>{reg.participant?.name || '—'}</strong>
                        <div className="text-muted small-text">{reg.participant?.phone || ''}</div>
                      </td>
                      <td>{reg.participant?.college || '—'}</td>
                      <td>
                        {displayedEvents.map((ev) => (
                          <div key={ev.eventId} className="roster-event-pill">
                            {ev.eventName}
                          </div>
                        ))}
                      </td>
                      <td>
                        {displayedEvents.map((ev) => (
                          <div key={ev.eventId} className="roster-member-badges-group">
                            {ev.members?.map((m) => (
                              <button
                                key={m.name}
                                type="button"
                                className={`roster-member-tag ${m.present ? 'tag-present' : 'tag-absent'}`}
                                onClick={() =>
                                  handleQuickToggleInRoster(reg.registrationId, ev.eventId, m.name, m.present)
                                }
                                title={`Click to toggle ${m.name} attendance`}
                              >
                                {m.present ? '✓' : '✗'} {m.name} {m.isLeader && '(L)'}
                              </button>
                            ))}
                          </div>
                        ))}
                      </td>
                      <td>
                        {displayedEvents.map((ev) => {
                          let badgeClass = 'badge-absent';
                          let label = `${ev.presentCount}/${ev.totalCount} Present`;
                          if (ev.allPresent) badgeClass = 'badge-present';
                          else if (ev.isPartial) badgeClass = 'badge-partial';

                          return (
                            <span key={ev.eventId} className={`attendance-pill ${badgeClass}`}>
                              {label}
                            </span>
                          );
                        })}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-sm button-secondary"
                          onClick={() => {
                            setActiveRegistration(reg);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          View & Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
