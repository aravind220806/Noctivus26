from app.services.assignment_reason_service import record_assignment_reasons, assignment_reason_text
from app.services.scheduler_service import slotsConflict


def slot(sid, event, start, end, members=(), capacity=30):
    return {'id': sid, 'event_id': event, 'date': '2026-09-26', 'start_time': start,
            'end_time': end, 'assigned_member_ids': list(members), 'capacity': capacity}


def reasons(selected, slots, current=()):
    return record_assignment_reasons(selected, slots, current, 'member', {'ignite': 'IGNITE', 'tune': 'Tune Trap'}, slotsConflict)


def test_records_other_event_causing_afternoon_assignment():
    fixed = slot('ignite', 'ignite', '10:00', '13:00')
    morning = slot('morning', 'tune', '10:00', '13:00')
    afternoon = slot('afternoon', 'tune', '13:00', '16:00')
    result = reasons([fixed, afternoon], [fixed, morning, afternoon])
    assert 'Only one session' in result['ignite']['text']
    assert '10:00–13:00 batch overlaps IGNITE (10:00–13:00)' in result['afternoon']['text']


def test_records_occupancy_at_assignment_time_not_export_time():
    morning = slot('morning', 'tune', '10:00', '13:00', ['existing'])
    afternoon = slot('afternoon', 'tune', '13:00', '16:00')
    slots = [morning, afternoon]
    saved = reasons([afternoon], slots)
    reg = {'assigned_slots': ['afternoon'], 'slot_assignment_reasons': saved}
    morning['assigned_member_ids'] = ['other', 'other2']
    afternoon['assigned_member_ids'] = ['member', 'later']
    text = assignment_reason_text(reg, afternoon, slots)
    assert 'had 0 members before assignment' in text
    assert 'batches had 1' in text


def test_records_tie_break_and_retained_batch():
    morning = slot('morning', 'tune', '10:00', '13:00')
    afternoon = slot('afternoon', 'tune', '13:00', '16:00')
    assert 'tied at 0' in reasons([morning], [morning, afternoon])['morning']['text']
    assert 'Kept the existing batch' in reasons([afternoon], [morning, afternoon], ['afternoon'])['afternoon']['text']


def test_records_full_alternative():
    morning = slot('morning', 'tune', '10:00', '13:00', ['existing'], capacity=1)
    afternoon = slot('afternoon', 'tune', '13:00', '16:00')
    assert 'was full at assignment time (1/1)' in reasons([afternoon], [morning, afternoon])['afternoon']['text']


def test_invalidates_reason_when_related_schedule_changes():
    morning = slot('morning', 'tune', '10:00', '13:00')
    afternoon = slot('afternoon', 'tune', '13:00', '16:00')
    reg = {'assigned_slots': ['morning'], 'slot_assignment_reasons': reasons([morning], [morning, afternoon])}
    afternoon['start_time'] = '14:00'
    assert 'schedule changed' in assignment_reason_text(reg, morning, [morning, afternoon])


def test_legacy_records_do_not_invent_balancing_reason():
    morning = slot('morning', 'tune', '10:00', '13:00')
    afternoon = slot('afternoon', 'tune', '13:00', '16:00')
    text = assignment_reason_text({'assigned_slots': ['morning']}, morning, [morning, afternoon])
    assert 'Run Auto-fix Schedule' in text
    assert 'Balances' not in text
