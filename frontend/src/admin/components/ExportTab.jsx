import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';
import { Filters } from './AdminUIHelpers';

export function ExportTab({ overview, authHeaders, eventId, setEventId, status, setStatus }) {
  const download = async () => {
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

  return (
    <section className="admin-panel export-panel">
      <h2>Export member details</h2>
      <Filters overview={overview} eventId={eventId} setEventId={setEventId} status={status} setStatus={setStatus} />
      <button className="button button-primary" onClick={download}>
        Export CSV <Icon name="external" />
      </button>
    </section>
  );
}
