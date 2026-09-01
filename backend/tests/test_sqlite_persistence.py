import pytest
from app.db.sqlite_db import sqlite_db
from app.services.registration_service import create_registration, load_registrations, update_registration
from app.services.scheduler_service import load_all_slots, save_slot, delete_slot
from app.services.event_service import list_events, get_event, update_event
from app.services.admin_access_service import resolve_admin_access, upsert_admin_access
from app.services.audit_service import record_admin_action, list_admin_actions


@pytest.mark.asyncio
async def test_sqlite_db_init_and_kv():
    await sqlite_db.init()
    assert sqlite_db.ready() is True

    # Test raw get / upsert / delete
    test_key = "TEST-REG-01"
    test_data = {"registrationId": test_key, "participant": {"name": "Test Participant"}}
    await sqlite_db.upsert("registrations", test_key, test_data)

    retrieved = await sqlite_db.get("registrations", test_key)
    assert retrieved is not None
    assert retrieved["registrationId"] == test_key
    assert retrieved["participant"]["name"] == "Test Participant"

    # Test update
    test_data["participant"]["name"] = "Updated Participant"
    await sqlite_db.upsert("registrations", test_key, test_data)
    retrieved = await sqlite_db.get("registrations", test_key)
    assert retrieved["participant"]["name"] == "Updated Participant"

    # Test delete
    deleted = await sqlite_db.delete("registrations", test_key)
    assert deleted is True
    assert await sqlite_db.get("registrations", test_key) is None


@pytest.mark.asyncio
async def test_sqlite_slots_and_events():
    await sqlite_db.init()

    # Test slots
    slot = {
        "id": "slot_test_morning_1",
        "event_id": "ctf",
        "date": "2026-09-26",
        "start_time": "09:00",
        "end_time": "12:00",
        "window": "morning",
        "capacity": 30,
        "assigned_member_ids": ["NOC26-A1B2C3"],
    }
    await save_slot(slot)
    slots = await load_all_slots()
    found = next((s for s in slots if s["id"] == "slot_test_morning_1"), None)
    assert found is not None
    assert found["capacity"] == 30

    await delete_slot("slot_test_morning_1")
    slots_after = await load_all_slots()
    assert not any(s["id"] == "slot_test_morning_1" for s in slots_after)


@pytest.mark.asyncio
async def test_sqlite_audit_log():
    await sqlite_db.init()
    await record_admin_action("admin@example.com", "test.action", "target1", {"detail": "sqlite_test"})
    actions = await list_admin_actions(search="sqlite_test")
    assert len(actions) > 0
    assert actions[0]["actor"] == "admin@example.com"
