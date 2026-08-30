import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';

export function EventSchedulerTab({ authHeaders }) {
  const [data, setData] = useState({ events: [], total_slots: 0, has_generated_slots: false, last_assignment_summary: null });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState(null);
  const [assignmentSummary, setAssignmentSummary] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [addingSlotEvent, setAddingSlotEvent] = useState(null);
  const [slotForm, setSlotForm] = useState({ window: 'morning', start_time: '09:00', end_time: '10:30', capacity: 30, date: '2026-09-26' });
  const [slotSaving, setSlotSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [managingEventSlots, setManagingEventSlots] = useState(null);

  const load = async () => {
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler'), { headers: authHeaders });
      const res = await response.json().catch(() => ({}));
      if (response.ok) {
        setData(res);
        if (res.last_assignment_summary) {
          setAssignmentSummary(res.last_assignment_summary);
        }
      } else {
        setMessage({ type: 'error', text: res.detail || res.message || 'Unable to load scheduler data.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect to scheduler service.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerateSlots = async (regenerate = false) => {
    setGenerating(true);
    setMessage(null);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/generate-slots'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to generate slots.');
      setMessage({
        type: 'success',
        text: regenerate ? 'Slots regenerated and previous assignments reset.' : res.message || 'Time slots generated successfully.',
      });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleRunAssignment = async () => {
    if (!data.has_generated_slots) {
      setMessage({ type: 'error', text: 'Generate slots first before running assignment.' });
      return;
    }
    setAssigning(true);
    setMessage(null);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/run-assignment'), {
        method: 'POST',
        headers: authHeaders,
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to run member assignment.');
      setAssignmentSummary(res);
      setMessage({
        type: 'success',
        text: `Assignment batch finished: ${res.successfully_assigned} members assigned successfully (${res.total_processed} processed).`,
      });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAssigning(false);
    }
  };

  const openEditSlot = (slot) => {
    setEditingSlot(slot);
    setSlotForm({
      window: slot.window || 'morning',
      start_time: slot.start_time || '09:00',
      end_time: slot.end_time || '10:30',
      capacity: slot.capacity || 30,
      date: slot.date || '2026-09-26',
    });
  };

  const openAddSlot = (eventObj) => {
    setAddingSlotEvent(eventObj);
    setSlotForm({
      window: 'morning',
      start_time: '09:00',
      end_time: '10:30',
      capacity: 30,
      date: eventObj.date || '2026-09-26',
    });
  };

  const saveEditedSlot = async (e) => {
    e.preventDefault();
    if (!editingSlot) return;
    setSlotSaving(true);
    try {
      const response = await adminFetch(apiPath(`/api/admin/scheduler/slots/${editingSlot.id}`), {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(slotForm),
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to update slot.');
      setMessage({ type: 'success', text: `Slot ${editingSlot.id} updated successfully.` });
      setEditingSlot(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSlotSaving(false);
    }
  };

  const createNewSlot = async (e) => {
    e.preventDefault();
    if (!addingSlotEvent) return;
    setSlotSaving(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/slots'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: addingSlotEvent.id,
          ...slotForm,
        }),
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to create slot.');
      setMessage({ type: 'success', text: `New slot added for ${addingSlotEvent.name}.` });
      setAddingSlotEvent(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSlotSaving(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await adminFetch(apiPath('/api/admin/scheduler/export'), {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to export schedule to Excel.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Noctivus26_Event_Schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setExporting(false);
    }
  };

  const deleteExistingSlot = async (slotId) => {
    if (!window.confirm(`Are you sure you want to delete slot ${slotId}?`)) return;
    try {
      const response = await adminFetch(apiPath(`/api/admin/scheduler/slots/${slotId}`), {
        method: 'DELETE',
        headers: authHeaders,
      });
      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.detail || res.message || 'Failed to delete slot.');
      setMessage({ type: 'success', text: `Slot ${slotId} deleted.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <section className="admin-panel">
        <p className="admin-loading-text">Loading Event Scheduler...</p>
      </section>
    );
  }

  return (
    <div className="admin-panel scheduler-panel-v2">
      <header className="scheduler-header">
        <div>
          <h2>Event Scheduler</h2>
          <p className="admin-help">Auto-generate conflict-free time slots and assign registered members with zero time overlap.</p>
        </div>
        <div className="scheduler-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={handleExportExcel}
            disabled={exporting || !data.has_generated_slots}
            title="Download complete schedule as Excel (.xlsx) workbook with Morning & Afternoon slots"
          >
            {exporting ? 'Exporting Excel...' : 'Download Excel'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => handleGenerateSlots(data.has_generated_slots)}
            disabled={generating || assigning}
          >
            {generating ? 'Generating slots...' : data.has_generated_slots ? 'Regenerate Slots' : 'Generate Slots'}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleRunAssignment}
            disabled={!data.has_generated_slots || assigning || generating}
            title={!data.has_generated_slots ? 'Generate slots first before running assignment' : 'Assign registered members into slots'}
          >
            {assigning ? 'Assigning members...' : 'Run Assignment'}
          </button>
        </div>
      </header>

      {message && (
        <div className={`admin-alert ${message.type === 'error' ? 'admin-alert--error' : 'admin-alert--success'}`}>
          <Icon name={message.type === 'error' ? 'shield' : 'check'} size={18} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Events & Slot Overview Table */}
      <section className="scheduler-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h3>Events Overview</h3>
          <small style={{ color: 'var(--muted)' }}>Slots auto-scale to accommodate all registered participants</small>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table scheduler-events-table">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Total Registrations</th>
                <th>Slots Generated</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <strong>{ev.name}</strong>
                    {ev.is_ctf && <span className="badge badge-ctf" style={{ marginLeft: 8 }}>CTF</span>}
                  </td>
                  <td>
                    <span className={`badge ${ev.category === 'tech' || ev.category === 'Technical' ? 'badge-tech' : 'badge-nontech'}`}>
                      {ev.category}
                    </span>
                  </td>
                  <td>{ev.duration_minutes} mins</td>
                  <td>
                    <strong style={{ color: ev.total_registrations > 0 ? '#4ade80' : 'var(--text)' }}>
                      {ev.total_registrations}
                    </strong>
                  </td>
                  <td>
                    <strong>{ev.slots_count}</strong> slots
                  </td>
                  <td>
                    <span className={`status-pill ${ev.slots_count > 0 ? 'status-pill--ready' : 'status-pill--pending'}`}>
                      {ev.slots_count > 0 ? 'Slots Ready' : 'No Slots'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="button button-primary button-small"
                        onClick={() => setManagingEventSlots(ev)}
                        title="View and edit all slots for this event"
                      >
                        Edit Slots
                      </button>
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => openAddSlot(ev)}
                        title="Add a new custom slot"
                      >
                        + Add Slot
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Results Panel */}
      {assignmentSummary && (
        <section className="scheduler-section scheduler-results-panel">
          <h3>Assignment Results</h3>
          <div className="admin-metrics scheduler-metrics">
            <article>
              <span>Total Processed</span>
              <strong>{assignmentSummary.total_processed ?? 0}</strong>
            </article>
            <article className="metric--success">
              <span>Successfully Assigned</span>
              <strong>{assignmentSummary.successfully_assigned ?? 0}</strong>
            </article>
            <article className="metric--warning">
              <span>Unassigned (Time Conflicts)</span>
              <strong>{assignmentSummary.unassigned_conflicts?.length ?? 0}</strong>
            </article>
            <article className="metric--danger">
              <span>Unassigned (Slots Full)</span>
              <strong>{assignmentSummary.unassigned_full?.length ?? 0}</strong>
            </article>
          </div>

          <div className="scheduler-unassigned-details">
            <details className="unassigned-group">
              <summary>
                <strong>Unassigned due to time conflicts ({assignmentSummary.unassigned_conflicts?.length ?? 0})</strong>
              </summary>
              {!assignmentSummary.unassigned_conflicts || assignmentSummary.unassigned_conflicts.length === 0 ? (
                <p className="admin-empty-sub">No conflict unassigned members.</p>
              ) : (
                <ul className="member-id-list">
                  {assignmentSummary.unassigned_conflicts.map((id) => (
                    <li key={id}>
                      <code>{id}</code>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <details className="unassigned-group">
              <summary>
                <strong>Unassigned due to full slots ({assignmentSummary.unassigned_full?.length ?? 0})</strong>
              </summary>
              {!assignmentSummary.unassigned_full || assignmentSummary.unassigned_full.length === 0 ? (
                <p className="admin-empty-sub">No members unassigned due to full capacity.</p>
              ) : (
                <ul className="member-id-list">
                  {assignmentSummary.unassigned_full.map((id) => (
                    <li key={id}>
                      <code>{id}</code>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        </section>
      )}

      {/* Schedule View per Event */}
      <section className="scheduler-section">
        <h3>Schedule View</h3>
        {!data.has_generated_slots ? (
          <p className="admin-empty">
            No slots generated yet. Click &quot;Generate Slots&quot; above to create morning and afternoon time windows.
          </p>
        ) : (
          <div className="scheduler-events-grid">
            {data.events.map((ev) => (
              <div className="scheduler-event-card" key={ev.id}>
                <div className="scheduler-event-card__header">
                  <div>
                    <h4>{ev.name}</h4>
                    <small>
                      {ev.category} · {ev.duration_minutes} mins / slot
                    </small>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="button button-secondary button-small" onClick={() => openAddSlot(ev)}>
                      + Add Slot
                    </button>
                    <span className="badge badge-slots">{ev.slots_count} slots</span>
                  </div>
                </div>

                <div className="scheduler-slots-table-wrap">
                  <table className="admin-table scheduler-slots-table">
                    <thead>
                      <tr>
                        <th>Window</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Capacity</th>
                        <th>Assigned</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.slots.map((slot) => {
                        const assignedCount = slot.assigned_member_ids?.length || 0;
                        const capacity = slot.capacity || 30;
                        const fillPercent = Math.min(100, Math.round((assignedCount / capacity) * 100));
                        return (
                          <tr key={slot.id}>
                            <td>
                              <span className={`window-tag window-tag--${slot.window}`}>
                                {slot.window === 'morning' ? 'Morning' : 'Afternoon'}
                              </span>
                            </td>
                            <td>
                              <code>{slot.start_time}</code>
                            </td>
                            <td>
                              <code>{slot.end_time}</code>
                            </td>
                            <td>
                              <div className="slot-capacity-bar-wrap">
                                <div className="slot-capacity-bar" style={{ width: `${fillPercent}%` }} />
                                <span>
                                  {assignedCount} / {capacity}
                                </span>
                              </div>
                            </td>
                            <td>
                              {assignedCount === 0 ? (
                                <span className="text-muted">Empty</span>
                              ) : (
                                <details className="slot-members-popover">
                                  <summary>{assignedCount} member(s)</summary>
                                  <ul>
                                    {slot.assigned_member_ids.map((mid) => (
                                      <li key={mid}>{mid}</li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="button button-secondary button-small"
                                  onClick={() => openEditSlot(slot)}
                                  title="Edit slot timing and capacity"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="button button-danger button-small"
                                  onClick={() => deleteExistingSlot(slot.id)}
                                  title="Delete this slot"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit Slot Modal */}
      {editingSlot && (
        <div className="modal-shell" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setEditingSlot(null)}>
          <div className="admin-modal-card" role="dialog" aria-labelledby="edit-slot-title">
            <header className="admin-modal-card__header">
              <div>
                <span className="kicker">SLOT CONFIGURATION</span>
                <h3 id="edit-slot-title">Edit Slot: {editingSlot.id}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditingSlot(null)}>
                <Icon name="close" />
              </button>
            </header>
            <form onSubmit={saveEditedSlot} className="admin-modal-form">
              <label className="field">
                <span>Window</span>
                <select value={slotForm.window} onChange={(e) => setSlotForm({ ...slotForm, window: e.target.value })}>
                  <option value="morning">Morning (09:00 - 12:30)</option>
                  <option value="afternoon">Afternoon (13:00 - 17:00)</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Start Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.start_time}
                    onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                    placeholder="09:00"
                  />
                </label>
                <label className="field">
                  <span>End Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.end_time}
                    onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                    placeholder="10:30"
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Capacity</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={slotForm.capacity}
                    onChange={(e) => setSlotForm({ ...slotForm, capacity: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input
                    type="text"
                    required
                    value={slotForm.date}
                    onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setEditingSlot(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={slotSaving}>
                  {slotSaving ? 'Saving...' : 'Save Slot Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Slot Modal */}
      {addingSlotEvent && (
        <div className="modal-shell" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setAddingSlotEvent(null)}>
          <div className="admin-modal-card" role="dialog" aria-labelledby="add-slot-title">
            <header className="admin-modal-card__header">
              <div>
                <span className="kicker">NEW SLOT</span>
                <h3 id="add-slot-title">Add Slot for {addingSlotEvent.name}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setAddingSlotEvent(null)}>
                <Icon name="close" />
              </button>
            </header>
            <form onSubmit={createNewSlot} className="admin-modal-form">
              <label className="field">
                <span>Window</span>
                <select value={slotForm.window} onChange={(e) => setSlotForm({ ...slotForm, window: e.target.value })}>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Start Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.start_time}
                    onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                    placeholder="09:00"
                  />
                </label>
                <label className="field">
                  <span>End Time (24h)</span>
                  <input
                    type="text"
                    required
                    value={slotForm.end_time}
                    onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                    placeholder="10:30"
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  <span>Capacity</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={slotForm.capacity}
                    onChange={(e) => setSlotForm({ ...slotForm, capacity: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input
                    type="text"
                    required
                    value={slotForm.date}
                    onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setAddingSlotEvent(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={slotSaving}>
                  {slotSaving ? 'Creating...' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Event Slots Modal */}
      {managingEventSlots && (
        <div
          className="modal-shell"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setManagingEventSlots(null)}
        >
          <div className="admin-modal-card admin-modal-card--wide" role="dialog" aria-labelledby="manage-event-slots-title">
            <header className="admin-modal-card__header">
              <div>
                <span className="kicker">MANAGE SLOTS</span>
                <h3 id="manage-event-slots-title">{managingEventSlots.name}</h3>
                <small style={{ color: 'var(--muted)' }}>
                  {managingEventSlots.category} · {managingEventSlots.duration_minutes} mins / slot ·{' '}
                  {managingEventSlots.total_registrations} Registered Members
                </small>
              </div>
              <button type="button" className="icon-button" onClick={() => setManagingEventSlots(null)}>
                <Icon name="close" />
              </button>
            </header>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px 0' }}>
              <strong>All Slots ({managingEventSlots.slots?.length || 0})</strong>
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => {
                  const ev = managingEventSlots;
                  setManagingEventSlots(null);
                  openAddSlot(ev);
                }}
              >
                + Add New Slot
              </button>
            </div>

            <div className="scheduler-slots-table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="admin-table scheduler-slots-table">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Capacity</th>
                    <th>Assigned</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.events.find((e) => e.id === managingEventSlots.id)?.slots || []).map((slot) => {
                    const assignedCount = slot.assigned_member_ids?.length || 0;
                    const capacity = slot.capacity || 30;
                    const fillPercent = Math.min(100, Math.round((assignedCount / capacity) * 100));
                    return (
                      <tr key={slot.id}>
                        <td>
                          <span className={`window-tag window-tag--${slot.window}`}>
                            {slot.window === 'morning' ? 'Morning' : 'Afternoon'}
                          </span>
                        </td>
                        <td>
                          <code>{slot.start_time}</code>
                        </td>
                        <td>
                          <code>{slot.end_time}</code>
                        </td>
                        <td>
                          <div className="slot-capacity-bar-wrap">
                            <div className="slot-capacity-bar" style={{ width: `${fillPercent}%` }} />
                            <span>
                              {assignedCount} / {capacity}
                            </span>
                          </div>
                        </td>
                        <td>
                          {assignedCount === 0 ? (
                            <span className="text-muted">Empty</span>
                          ) : (
                            <details className="slot-members-popover">
                              <summary>{assignedCount} member(s)</summary>
                              <ul>
                                {slot.assigned_member_ids.map((mid) => (
                                  <li key={mid}>{mid}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="button button-secondary button-small"
                              onClick={() => {
                                const s = slot;
                                setManagingEventSlots(null);
                                openEditSlot(s);
                              }}
                              title="Edit slot timing and capacity"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button button-danger button-small"
                              onClick={() => deleteExistingSlot(slot.id)}
                              title="Delete this slot"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setManagingEventSlots(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
