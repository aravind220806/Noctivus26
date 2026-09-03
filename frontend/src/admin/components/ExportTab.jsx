import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';
import { Filters } from './AdminUIHelpers';

export function ExportTab({ overview, authHeaders, eventId, setEventId, status, setStatus }) {
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const downloadCsv = async () => {
    setDownloadingCsv(true);
    try {
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
    } finally {
      setDownloadingCsv(false);
    }
  };

  const downloadAttendanceExcel = async () => {
    setDownloadingExcel(true);
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
      }
    } finally {
      setDownloadingExcel(false);
    }
  };

  return (
    <div className="admin-grid admin-grid--wide">
      <section className="admin-panel export-panel">
        <h2>Export Member Details (CSV)</h2>
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '13px' }}>
          Download general participant and payment registration data filtered by event or payment status.
        </p>
        <Filters overview={overview} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} />
        <button className="button button-primary" onClick={downloadCsv} disabled={downloadingCsv} style={{ marginTop: '16px' }}>
          {downloadingCsv ? 'Exporting CSV...' : 'Export CSV'} <Icon name="external" />
        </button>
      </section>

      <section className="admin-panel export-panel highlight-panel">
        <h2>Event-Wise Attendance Workbook (.xlsx)</h2>
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '13px' }}>
          Export a single comprehensive Excel workbook with <strong>individual tabs for every event</strong>, formatted specifically for <strong>E-Certificate Generation</strong> with member names, attendance status, and roles.
        </p>
        <div style={{ background: '#090d16', padding: '14px', borderRadius: '10px', marginBottom: '18px', border: '1px solid #1e293b' }}>
          <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Included in this Workbook:</div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
            <li><strong>Master Summary Sheet:</strong> Overview of teams, members, and attendance rate per event.</li>
            <li><strong>Separate Sheets per Event:</strong> Roster of all present/absent members for every single event.</li>
            <li><strong>E-Cert Master Sheet:</strong> Ready-to-use list of all verified present members.</li>
          </ul>
        </div>
        <button className="button button-primary" onClick={downloadAttendanceExcel} disabled={downloadingExcel}>
          {downloadingExcel ? 'Generating Excel Workbook...' : 'Download Event-Wise Attendance (.xlsx)'} <Icon name="external" />
        </button>
      </section>
    </div>
  );
}
