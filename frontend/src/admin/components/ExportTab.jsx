import { useState, useEffect } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';
import { Filters } from './AdminUIHelpers';

export function ExportTab({ overview, authHeaders, eventId, setEventId, status, setStatus }) {
  const [sheetsStatus, setSheetsStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingAttExcel, setDownloadingAttExcel] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const fetchSheetsStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await adminFetch(apiPath('/api/admin/sheets/status'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSheetsStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch sheets status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchSheetsStatus();
  }, []);

  const handleSyncAllToSheets = async () => {
    setSyncingSheets(true);
    setSyncMessage(null);
    try {
      const res = await adminFetch(apiPath('/api/admin/sheets/sync-all'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage({ type: 'success', text: data.message || 'All sheets synchronized successfully!' });
        if (data.status) setSheetsStatus(data.status);
      } else {
        setSyncMessage({ type: 'error', text: data.detail || 'Synchronization failed.' });
      }
    } catch (err) {
      setSyncMessage({ type: 'error', text: 'Network error during Google Sheets synchronization.' });
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleDownloadMasterExcel = async () => {
    setDownloadingExcel(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/sheets/export-excel'), {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to generate Excel file');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `noctivus-master-live-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download Master Excel backup: ' + err.message);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleDownloadAttendanceExcel = async () => {
    setDownloadingAttExcel(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/attendance/export-excel'), {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to generate Attendance Excel file');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `noctivus-event-attendance-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download Attendance Excel: ' + err.message);
    } finally {
      setDownloadingAttExcel(false);
    }
  };

  const downloadCsv = async () => {
    const response = await adminFetch(
      apiPath(`/api/admin/export?${new URLSearchParams({ ...(eventId && { eventId }), ...(status && { status }) })}`),
      { headers: authHeaders }
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `noctivus-${eventId || 'all'}-registrations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyServiceEmail = () => {
    if (sheetsStatus?.serviceAccountEmail) {
      navigator.clipboard.writeText(sheetsStatus.serviceAccountEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  return (
    <div className="admin-panel export-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', letterSpacing: '-0.02em' }}>Live Sync & Data Exports</h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
          Real-time Google Sheets synchronization, live multi-sheet master Excel backups, and filtered participant CSV exports.
        </p>
      </div>

      {/* ── CARD 1: GOOGLE SHEETS LIVE SYNC ── */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.37)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📊</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#F8FAFC' }}>Google Sheets Live Sync Engine</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>
                Automatically synchronizes registrations, verified payments, check-in scans, event attendance, and scheduler slots.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {sheetsStatus?.enabled ? (
              <span
                style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid #22c55e',
                  color: '#4ade80',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                LIVE SYNC ACTIVE
              </span>
            ) : (
              <span
                style={{
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid #eab308',
                  color: '#fde047',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {sheetsStatus?.configured ? 'SYNC DISABLED' : 'SETUP REQUIRED'}
              </span>
            )}
            <button
              className="button button-secondary"
              onClick={fetchSheetsStatus}
              disabled={loadingStatus}
              title="Refresh status"
              style={{ padding: '6px 12px' }}
            >
              <Icon name="refresh" />
            </button>
          </div>
        </div>

        {/* Sync Info Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            background: 'rgba(0,0,0,0.25)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spreadsheet ID</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0', marginTop: '4px', wordBreak: 'break-all' }}>
              {sheetsStatus?.spreadsheetId ? (
                <span>{sheetsStatus.spreadsheetId}</span>
              ) : (
                <span style={{ color: '#F59E0B' }}>Not set in .env</span>
              )}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Synchronized</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0', marginTop: '4px' }}>
              {sheetsStatus?.lastSyncedAt ? (
                new Date(sheetsStatus.lastSyncedAt).toLocaleString()
              ) : (
                <span style={{ color: '#94A3B8' }}>No sync performed yet</span>
              )}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Operations Synced</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#38BDF8', marginTop: '4px' }}>
              {sheetsStatus?.totalSyncCount ?? 0} updates
            </div>
          </div>
        </div>

        {/* Service Account Setup Helper */}
        {sheetsStatus?.serviceAccountEmail && (
          <div
            style={{
              fontSize: '12px',
              color: '#CBD5E1',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '6px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span>
              ℹ️ Share your Google Sheet with: <strong style={{ color: '#38BDF8' }}>{sheetsStatus.serviceAccountEmail}</strong> (Editor role)
            </span>
            <button
              className="button button-secondary"
              onClick={copyServiceEmail}
              style={{ padding: '3px 10px', fontSize: '11px' }}
            >
              {copiedEmail ? '✓ Copied!' : 'Copy Email'}
            </button>
          </div>
        )}

        {/* Feedback Message */}
        {syncMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              background: syncMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${syncMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
              color: syncMessage.type === 'success' ? '#86efac' : '#fca5a5',
            }}
          >
            {syncMessage.text}
          </div>
        )}

        {/* Actions for Google Sheets */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="button button-primary"
            onClick={handleSyncAllToSheets}
            disabled={syncingSheets || !sheetsStatus?.configured}
            style={{ background: '#0284C7', borderColor: '#38BDF8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {syncingSheets ? <Icon name="refresh" /> : <Icon name="check" />}
            {syncingSheets ? 'Syncing Database to Google Sheet...' : 'Sync Everything to Google Sheet Now'}
          </button>

          {sheetsStatus?.spreadsheetUrl && (
            <a
              href={sheetsStatus.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="button button-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
            >
              Open Live Google Sheet <Icon name="external" />
            </a>
          )}
        </div>
      </div>

      {/* ── CARD 2: MASTER MULTI-SHEET EXCEL BACKUP (.XLSX) ── */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.37)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📗</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#F8FAFC' }}>Master Multi-Sheet Excel Backup (.xlsx)</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>
              Full live database snapshot with formatted, dedicated worksheets for all festival operations.
            </p>
          </div>
        </div>

        {/* Included Sheets Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            'Registered (All Members)',
            'Verified (Confirmed Payments)',
            'Check-In List (Gate Scans)',
            'Master Event Slots',
            'Scheduler Summary',
            'Member Allocations',
            'Per-Event Attendance Sheets',
          ].map((sheetName, i) => (
            <span
              key={i}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6EE7B7',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              📄 {sheetName}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
          <button
            className="button button-primary"
            onClick={handleDownloadMasterExcel}
            disabled={downloadingExcel}
            style={{ background: '#059669', borderColor: '#34D399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {downloadingExcel ? <Icon name="refresh" /> : <Icon name="external" />}
            {downloadingExcel ? 'Generating Master Excel...' : 'Download Master Live Backup (.xlsx)'}
          </button>

          <button
            className="button button-secondary"
            onClick={handleDownloadAttendanceExcel}
            disabled={downloadingAttExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {downloadingAttExcel ? <Icon name="refresh" /> : <Icon name="external" />}
            {downloadingAttExcel ? 'Generating Attendance Excel...' : 'Download Event Attendance (.xlsx)'}
          </button>
        </div>
      </div>

      {/* ── CARD 3: TARGETED FILTERED CSV EXPORT ── */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📁</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#F8FAFC' }}>Filtered CSV Export</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>
              Filter by specific event or payment verification status and download as CSV.
            </p>
          </div>
        </div>

        <Filters overview={overview} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} />

        <div>
          <button className="button button-secondary" onClick={downloadCsv} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Export Filtered CSV <Icon name="external" />
          </button>
        </div>
      </div>
    </div>
  );
}
