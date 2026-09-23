from copy import deepcopy

import pytest
import pytest_asyncio

from app.services import scheduler_service as scheduler
from app.services import event_service
from app.db import sqlite_db as db_module


@pytest_asyncio.fixture(params=['memory', 'sqlite'])
async def store(request, monkeypatch, tmp_path):
    db = db_module._SQLiteDB()
    monkeypatch.setattr(db_module, 'DB_PATH', tmp_path / 'scheduler.db')
    monkeypatch.setattr(scheduler, 'sqlite_db', db)
    monkeypatch.setattr(event_service, 'sqlite_db', db)
    monkeypatch.setattr(scheduler, 'memory_event_slots', [])
    monkeypatch.setattr(scheduler, 'memory_registrations', [])
    monkeypatch.setattr(event_service, 'memory_events', [])
    monkeypatch.setattr(scheduler, '_last_assignment_summary', None)
    if request.param == 'sqlite':
        await db.init()
    rows = {}

    async def load(filters=None):
        return [deepcopy(row) for row in rows.values()
                if not filters or all(row.get(key) == value for key, value in filters.items())]

    async def update(member_id, changes):
        rows[member_id].update(deepcopy(changes))
        return deepcopy(rows[member_id])

    monkeypatch.setattr(scheduler, 'load_registrations', load)
    monkeypatch.setattr(scheduler, 'update_registration', update)
    return rows


def registration(member_id, events, assigned=()):
    return {'registrationId': member_id, 'status': 'confirmed', 'event_ids': events,
            'eventRegistrations': [{'eventId': eid} for eid in events], 'assigned_slots': list(assigned)}


def slot(slot_id, event='bug-hunt', start='10:00', end='13:00', members=(), capacity=30):
    return {'id': slot_id, 'event_id': event, 'date': '2026-09-26', 'window': 'morning',
            'start_time': start, 'end_time': end, 'capacity': capacity, 'assigned_member_ids': list(members)}


@pytest.mark.asyncio
async def test_choose_two_splits_and_choose_one_combines_all_members(store):
    for index in range(65):
        mid = f'm{index}'
        store[mid] = registration(mid, ['bug-hunt'])
    result = await scheduler.configure_event_slots('bug-hunt', 2, 'admin')
    slots = await scheduler.load_all_slots()
    assert len(slots) == 2
    assert sorted(len(s['assigned_member_ids']) for s in slots) == [32, 33]
    assert result['assignment_summary']['successfully_assigned'] == 65
    assert (await event_service.get_event('bug-hunt'))['slot_count'] == 2
    await scheduler.configure_event_slots('bug-hunt', 1, 'admin')
    slots = await scheduler.load_all_slots()
    assert len(slots) == 1
    assert len(slots[0]['assigned_member_ids']) == 65
    assert slots[0]['capacity'] >= 65
    assert all(row['assigned_slots'] == [slots[0]['id']] for row in store.values())


@pytest.mark.asyncio
async def test_delete_reassigns_partial_registration_and_preserves_other_event(store):
    store['member'] = registration('member', ['bug-hunt', 'tune-trap'], ['deleted', 'other'])
    await scheduler.save_slot(slot('deleted', members=['member']))
    await scheduler.save_slot(slot('remaining'))
    await scheduler.save_slot(slot('other', 'tune-trap', '13:00', '16:00', ['member']))
    assert await scheduler.delete_slot('deleted')
    assert set(store['member']['assigned_slots']) == {'remaining', 'other'}
    assert store['member']['eventRegistrations'][0]['batchTime'] == '10:00'
    remaining = await scheduler.get_slot('remaining')
    assert remaining['assigned_member_ids'] == ['member']
    await scheduler.assignMembersToSlots(auto_generate=False)
    assert (await scheduler.get_slot('remaining'))['assigned_member_ids'] == ['member']


@pytest.mark.asyncio
async def test_delete_combines_members_and_expands_remaining_capacity(store):
    for index in range(40):
        mid = f'm{index}'
        store[mid] = registration(mid, ['bug-hunt'], ['deleted' if index < 20 else 'remaining'])
    await scheduler.save_slot(slot('deleted', members=[f'm{i}' for i in range(20)]))
    await scheduler.save_slot(slot('remaining', members=[f'm{i}' for i in range(20, 40)]))
    await scheduler.delete_slot('deleted')
    slots = await scheduler.load_all_slots()
    assert len(slots) == 1
    assert slots[0]['capacity'] >= 40
    assert len(slots[0]['assigned_member_ids']) == 40


@pytest.mark.asyncio
async def test_delete_last_slot_does_not_recreate_on_dashboard_load(store):
    store['member'] = registration('member', ['bug-hunt'], ['deleted'])
    await scheduler.save_slot(slot('deleted', members=['member']))
    await scheduler.delete_slot('deleted')
    await scheduler.get_scheduler_dashboard_data()
    assert await scheduler.load_all_slots() == []
    assert store['member']['assigned_slots'] == []
    assert scheduler._last_assignment_summary['unassigned_full'] == ['member']


@pytest.mark.asyncio
async def test_conflict_is_reported_without_creating_extra_slots(store):
    store['member'] = registration('member', ['bug-hunt', 'tune-trap'], ['deleted', 'other'])
    await scheduler.save_slot(slot('deleted', members=['member']))
    await scheduler.save_slot(slot('remaining'))
    await scheduler.save_slot(slot('other', 'tune-trap', members=['member']))
    await scheduler.delete_slot('deleted')
    assert store['member']['assigned_slots'] == ['other']
    assert scheduler._last_assignment_summary['unassigned_conflicts'] == ['member']
    assert len(await scheduler.load_all_slots()) == 2


@pytest.mark.asyncio
async def test_move_other_assignment_when_needed_for_valid_pair(store):
    store['member'] = registration('member', ['bug-hunt', 'tune-trap'], ['deleted', 'other'])
    for item in [slot('deleted', members=['member']), slot('remaining'),
                 slot('other', 'tune-trap', members=['member']),
                 slot('later', 'tune-trap', '13:00', '16:00')]:
        await scheduler.save_slot(item)
    await scheduler.delete_slot('deleted')
    assert set(store['member']['assigned_slots']) == {'remaining', 'later'}
    assert (await scheduler.get_slot('other'))['assigned_member_ids'] == []


@pytest.mark.asyncio
async def test_full_custom_slots_are_reported(store):
    store['existing'] = registration('existing', ['bug-hunt'], ['only'])
    store['waiting'] = registration('waiting', ['bug-hunt'])
    await scheduler.save_slot(slot('only', members=['existing'], capacity=1))
    result = await scheduler.assignMembersToSlots(auto_generate=False)
    assert result['unassigned_full'] == ['waiting']
    assert len(await scheduler.load_all_slots()) == 1


@pytest.mark.parametrize('count', [0, 3, True, '2', None])
@pytest.mark.asyncio
async def test_invalid_slot_count_rejected_without_mutation(store, count):
    with pytest.raises(ValueError):
        await scheduler.configure_event_slots('bug-hunt', count, 'admin')
    assert await scheduler.load_all_slots() == []


@pytest.mark.parametrize('event_id', ['bug-hunt', 'prompt-heist', 'ignite', 'ctf', 'tune-trap'])
@pytest.mark.parametrize('count', [1, 2])
def test_generation_respects_choice_regardless_of_registration_count(event_id, count):
    slots = scheduler.generateSlotsForEvent({'id': event_id, 'slot_count': count, 'duration_minutes': 180}, 200)
    assert len(slots) == count
    assert slots[0]['start_time'] == '10:00'
    assert sum(s['capacity'] for s in slots) >= 200
    if count == 2:
        assert not scheduler.slotsConflict(*slots)


@pytest.mark.asyncio
async def test_splitting_remaining_afternoon_slot_uses_distinct_ids(store):
    store['member'] = registration('member', ['bug-hunt'])
    await scheduler.configure_event_slots('bug-hunt', 2, 'admin')
    await scheduler.delete_slot('slot_bug-hunt_morning_1')
    await scheduler.configure_event_slots('bug-hunt', 2, 'admin')
    slots = await scheduler.load_all_slots()
    assert len(slots) == 2
    assert len({slot['id'] for slot in slots}) == 2
    assert not scheduler.slotsConflict(*slots)


@pytest.mark.asyncio
async def test_new_members_fit_configured_single_slot_without_expansion(store):
    await scheduler.configure_event_slots('bug-hunt', 1, 'admin')
    for index in range(40):
        mid = f'm{index}'
        store[mid] = registration(mid, ['bug-hunt'])
    summary = await scheduler.assignMembersToSlots(auto_generate=False)
    assert summary['successfully_assigned'] == 40
    assert len(await scheduler.load_all_slots()) == 1
