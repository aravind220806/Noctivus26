"""Record assignment decisions separately from changing slot occupancy."""


def schedule_context(slot: dict, selected: list[dict], slots: list[dict]) -> list[list[str]]:
    relevant_ids = {item['id'] for item in selected}
    return sorted([
        [item['id'], item.get('event_id', ''), item.get('date', ''), item.get('start_time', ''), item.get('end_time', '')]
        for item in slots if item['id'] in relevant_ids or item.get('event_id') == slot.get('event_id')
    ])


def record_assignment_reasons(selected, slots, current, member_id, event_names, conflicts):
    reasons = {}
    for slot in selected:
        others = [item for item in selected if item['id'] != slot['id']]
        alternatives = [item for item in slots if item['event_id'] == slot['event_id'] and item['id'] != slot['id']]
        details = []
        viable = []
        for alternative in alternatives:
            label = f"{alternative['start_time']}–{alternative['end_time']}"
            overlaps = [item for item in others if conflicts(alternative, item)]
            occupancy = len([mid for mid in alternative.get('assigned_member_ids', []) if mid != member_id])
            if overlaps:
                names = ', '.join(f"{event_names.get(item['event_id'], item['event_id'])} ({item['start_time']}–{item['end_time']})" for item in overlaps)
                details.append(f"The {label} batch overlaps {names}.")
            elif occupancy >= alternative.get('capacity', 30):
                details.append(f"The {label} batch was full at assignment time ({occupancy}/{alternative.get('capacity', 30)}).")
            else:
                viable.append(alternative)
        if not alternatives:
            reason = 'Only one session is scheduled for this event; all members attend this session.'
        elif slot['id'] in current:
            reason = 'Kept the existing batch because it has space and does not overlap the member’s other assigned events.'
        elif not viable:
            reason = 'Chosen because the other batch options conflict with another assigned event or have no space.'
        else:
            occupancy = len([mid for mid in slot.get('assigned_member_ids', []) if mid != member_id])
            counts = [len([mid for mid in item.get('assigned_member_ids', []) if mid != member_id]) for item in viable]
            if occupancy < min(counts):
                reason = f'Balances the batches: this batch had {occupancy} members before assignment; the other compatible batches had {", ".join(map(str, counts))}.'
            elif occupancy == min(counts) and not any(item['id'] in current for item in viable):
                reason = f'Compatible batches were tied at {occupancy} members. The algorithm tried earlier start times first, in registered-event order, and selected the first conflict-free combination.'
            else:
                reason = 'Selected as part of the first conflict-free event combination, prioritizing existing assignments, then batch occupancy and earlier start times.'
        if others:
            details.append('Compatible with ' + ', '.join(f"{event_names.get(item['event_id'], item['event_id'])} ({item['start_time']}–{item['end_time']})" for item in others) + '.')
        reasons[slot['id']] = {'text': ' '.join([reason, *details]),
                              'context': schedule_context(slot, selected, slots)}
    return reasons


def assignment_reason_text(registration: dict, slot: dict, slots: list[dict]) -> str:
    by_id = {item['id']: item for item in slots}
    selected = [by_id[sid] for sid in registration.get('assigned_slots', []) if sid in by_id]
    saved = (registration.get('slot_assignment_reasons') or {}).get(slot['id'])
    if saved and saved.get('context') == schedule_context(slot, selected, slots):
        return saved['text']
    same_event = [item for item in slots if item['event_id'] == slot['event_id']]
    if len(same_event) == 1:
        return 'Current schedule: only one session is available for this event; all members attend it. The original assignment decision was not recorded.'
    return 'The original assignment reason is unavailable or the schedule changed. Run Auto-fix Schedule to record why this member receives this batch.'
