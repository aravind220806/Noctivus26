import { useEffect, useMemo, useState } from 'react';
import { adminFetch, apiPath } from '../adminUtils';
import { Skeleton } from './AdminUIHelpers';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function money(value) {
  return currency.format(Number(value || 0));
}

function displayDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function DayBookTab({ authHeaders }) {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDate, setOpenDate] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminFetch(apiPath('/api/admin/day-book'), { headers: authHeaders })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Unable to load day book.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setBook(data);
        setOpenDate(data.today?.date || data.days?.[0]?.date || '');
      })
      .catch((loadError) => active && setError(loadError.message || 'Unable to load day book.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authHeaders]);

  const rows = useMemo(() => book?.days || [], [book]);

  if (loading) return <Skeleton />;
  if (error) return <p className="admin-message">{error}</p>;

  const today = book?.today || {};
  const totals = book?.totals || {};

  return (
    <div className="day-book">
      <section className="day-book-summary">
        <article>
          <span>Today Registrations</span>
          <strong>{today.registrations || 0}</strong>
        </article>
        <article>
          <span>Today Earned</span>
          <strong>{money(today.confirmedAmount)}</strong>
        </article>
        <article>
          <span>Today Pending</span>
          <strong>{today.pending || 0}</strong>
        </article>
        <article>
          <span>Total Earned</span>
          <strong>{money(totals.confirmedAmount)}</strong>
        </article>
      </section>

      <section className="admin-panel day-book-panel">
        <h2>Payment Day Book</h2>
        <div className="day-book-table">
          <div className="day-book-table__head">
            <span>Date</span>
            <span>Registrations</span>
            <span>Confirmed</span>
            <span>Pending</span>
            <span>Mismatch</span>
            <span>Duplicate</span>
            <span>Earned</span>
          </div>
          {rows.length === 0 ? (
            <p className="admin-empty">No registration accounts yet.</p>
          ) : (
            rows.map((day) => {
              const isOpen = openDate === day.date;
              return (
                <article className="day-book-day" key={day.date}>
                  <button type="button" className="day-book-row" onClick={() => setOpenDate(isOpen ? '' : day.date)}>
                    <strong>{displayDate(day.date)}</strong>
                    <span>{day.registrations}</span>
                    <span>{day.confirmed}</span>
                    <span>{day.pending}</span>
                    <span>{day.mismatch}</span>
                    <span>{day.duplicate}</span>
                    <strong>{money(day.confirmedAmount)}</strong>
                  </button>
                  {isOpen && (
                    <div className="day-book-records">
                      {day.records.map((record) => (
                        <div key={record.registrationId} className="day-book-record">
                          <span>{record.registrationId}</span>
                          <strong>{record.name || 'Participant'}</strong>
                          <span>{record.phone || '-'}</span>
                          <span>{record.events?.join(', ') || 'No events'}</span>
                          <span className={`status-pill status-pill--${record.status}`}>{record.status}</span>
                          <strong>{money(record.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
