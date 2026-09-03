import { DashboardContent } from '../../components/bionis/dashboard-content';
import { adminFetch, apiPath } from '../adminUtils';
import { Skeleton } from './AdminUIHelpers';

export function DashboardTab({ overview, onRefresh, authHeaders }) {
  if (!overview) return <Skeleton />;
  const handleToggleEventStatus = async (eventId, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    const response = await adminFetch(apiPath(`/api/admin/events/${eventId}`), {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok && onRefresh) onRefresh();
  };
  return <DashboardContent overview={overview} onToggleEventStatus={handleToggleEventStatus} />;
}
