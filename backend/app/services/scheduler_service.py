import math
from datetime import datetime, timezone
from pymongo import ReturnDocument

from app.db import mongo
from app.db.memory_store import memory_event_slots
from app.services.event_service import list_events
from app.services.registration_service import load_registrations, update_registration

_last_assignment_summary: dict | None = None


def _format_time_minutes(minutes_from_midnight: int) -> str:
    hours = minutes_from_midnight // 60
    mins = minutes_from_midnight % 60
    return f"{hours:02d}:{mins:02d}"


def _parse_time_to_minutes(time_str: str) -> int:
    clean = str(time_str or "").strip()
    if not clean:
        return 0
    upper = clean.upper()
    if "AM" in upper or "PM" in upper:
        is_pm = "PM" in upper
        clean_digits = upper.replace("AM", "").replace("PM", "").strip()
        parts = clean_digits.split(":")
        hours = int(parts[0])
        mins = int(parts[1]) if len(parts) > 1 else 0
        if is_pm and hours < 12:
            hours += 12
        elif not is_pm and hours == 12:
            hours = 0
        return hours * 60 + mins
    parts = clean.split(":")
    hours = int(parts[0])
    mins = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + mins


def slotsConflict(slotA: dict, slotB: dict) -> bool:
    if str(slotA.get("date") or "").strip() != str(slotB.get("date") or "").strip():
        return False
    start_a = _parse_time_to_minutes(slotA.get("start_time", "09:00"))
    end_a = _parse_time_to_minutes(slotA.get("end_time", "10:30"))
    start_b = _parse_time_to_minutes(slotB.get("start_time", "09:00"))
    end_b = _parse_time_to_minutes(slotB.get("end_time", "10:30"))

    if start_a < end_b and start_b < end_a:
        return True
    return False


def serialize_slot(slot: dict) -> dict:
    item = dict(slot)
    if "_id" in item:
        item["_id"] = str(item["_id"])
    return item


async def load_all_slots() -> list[dict]:
    try:
        if mongo.mongo_ready():
            cursor = mongo.db.event_slots.find({}).sort("start_time", 1)
            docs = await cursor.to_list(length=1000)
            return [serialize_slot(doc) for doc in docs]
    except Exception as error:
        print(f"Falling back to in-memory slots: {error}")
        mongo.client = None
        mongo.db = None
    return [serialize_slot(s) for s in memory_event_slots]


async def save_slot(slot: dict) -> None:
    clean_slot = {k: v for k, v in slot.items() if k != "_id"}
    try:
        if mongo.mongo_ready():
            await mongo.db.event_slots.update_one(
                {"id": clean_slot["id"]},
                {"$set": clean_slot},
                upsert=True,
            )
            return
    except Exception as error:
        print(f"Mongo slot save failed: {error}")
        mongo.client = None
        mongo.db = None
    for i, s in enumerate(memory_event_slots):
        if s.get("id") == clean_slot["id"]:
            memory_event_slots[i] = clean_slot
            return
    memory_event_slots.append(clean_slot)


async def get_slot(slot_id: str) -> dict | None:
    slots = await load_all_slots()
    return next((s for s in slots if s.get("id") == slot_id), None)


async def update_slot(slot_id: str, updates: dict) -> dict | None:
    slot = await get_slot(slot_id)
    if not slot:
        return None

    allowed = {"start_time", "end_time", "capacity", "window", "date"}
    clean_updates = {}
    for k, v in updates.items():
        if k in allowed:
            if k == "capacity":
                try:
                    clean_updates["capacity"] = max(1, int(v))
                except (ValueError, TypeError):
                    pass
            elif k in ("start_time", "end_time"):
                clean_updates[k] = str(v).strip()
            elif k == "window":
                clean_updates["window"] = "afternoon" if str(v).lower() == "afternoon" else "morning"
            elif k == "date":
                clean_updates["date"] = str(v).strip()

    merged = {**slot, **clean_updates}
    await save_slot(merged)
    return merged


async def create_custom_slot(data: dict) -> dict:
    event_id = str(data.get("event_id") or "").strip()
    window = "afternoon" if str(data.get("window")).lower() == "afternoon" else "morning"
    start_time = str(data.get("start_time") or "09:00").strip()
    end_time = str(data.get("end_time") or "10:30").strip()
    capacity = max(1, int(data.get("capacity") or 30))
    date = str(data.get("date") or "2026-09-26").strip()
    slot_id = f"slot_{event_id}_{window}_{int(datetime.now(timezone.utc).timestamp() * 1000) % 100000}"

    new_slot = {
        "id": slot_id,
        "event_id": event_id,
        "date": date,
        "start_time": start_time,
        "end_time": end_time,
        "window": window,
        "capacity": capacity,
        "assigned_member_ids": [],
    }
    await save_slot(new_slot)
    return new_slot


async def create_next_auto_slot(event: dict, existing_slots: list[dict]) -> dict:
    duration = int(event.get("duration_minutes") or 90)
    if duration <= 0:
        duration = 90
    date_str = str(event.get("date") or "2026-09-26").strip()

    if not existing_slots:
        # Start at morning 09:00
        start_mins = 540
        end_mins = start_mins + duration
        window = "morning"
        idx = 1
    else:
        last_slot = existing_slots[-1]
        last_end_mins = _parse_time_to_minutes(last_slot.get("end_time", "10:30"))
        if last_end_mins + duration <= 750: # fits before 12:30 morning
            start_mins = last_end_mins
            end_mins = start_mins + duration
            window = "morning"
        elif last_end_mins < 780: # jump to afternoon 13:00
            start_mins = 780
            end_mins = start_mins + duration
            window = "afternoon"
        else: # continue in afternoon / evening
            start_mins = last_end_mins
            end_mins = start_mins + duration
            window = "afternoon"
        idx = len(existing_slots) + 1

    slot_id = f"slot_{event['id']}_{window}_{idx}"
    new_slot = {
        "id": slot_id,
        "event_id": event["id"],
        "date": date_str,
        "start_time": _format_time_minutes(start_mins),
        "end_time": _format_time_minutes(end_mins),
        "window": window,
        "capacity": 30,
        "assigned_member_ids": [],
    }
    await save_slot(new_slot)
    return new_slot


async def delete_slot(slot_id: str) -> bool:
    try:
        if mongo.mongo_ready():
            res = await mongo.db.event_slots.delete_one({"id": slot_id})
            return res.deleted_count > 0
    except Exception:
        pass
    for i, s in enumerate(memory_event_slots):
        if s.get("id") == slot_id:
            memory_event_slots.pop(i)
            return True
    return False


def generateSlotsForEvent(event: dict, registration_count: int = 0) -> list[dict]:
    duration = int(event.get("duration_minutes") or 90)
    if duration <= 0:
        duration = 90

    # Morning window: 09:00 (540m) to 12:30 (750m) -> 210 minutes
    # Afternoon window: 13:00 (780m) to 17:00 (1020m) -> 240 minutes
    morning_slot_count = max(1, math.floor(210 / duration))
    afternoon_slot_count = max(1, math.floor(240 / duration))

    # Calculate if extra slots are needed for higher registration counts
    total_base_capacity = (morning_slot_count + afternoon_slot_count) * 30
    extra_afternoon_slots = 0
    if registration_count > total_base_capacity:
        extra_afternoon_slots = math.ceil((registration_count - total_base_capacity) / 30)

    date_str = str(event.get("date") or "2026-09-26").strip()
    slots = []

    # Morning slots starting at 09:00
    morning_start = 540
    for i in range(morning_slot_count):
        slot_start_mins = morning_start + i * duration
        slot_end_mins = slot_start_mins + duration
        slots.append({
            "id": f"slot_{event['id']}_morning_{i+1}",
            "event_id": event["id"],
            "date": date_str,
            "start_time": _format_time_minutes(slot_start_mins),
            "end_time": _format_time_minutes(slot_end_mins),
            "window": "morning",
            "capacity": 30,
            "assigned_member_ids": [],
        })

    # Afternoon slots starting at 13:00 (including any dynamically needed slots)
    afternoon_start = 780
    total_afternoon = afternoon_slot_count + extra_afternoon_slots
    for i in range(total_afternoon):
        slot_start_mins = afternoon_start + i * duration
        slot_end_mins = slot_start_mins + duration
        slots.append({
            "id": f"slot_{event['id']}_afternoon_{i+1}",
            "event_id": event["id"],
            "date": date_str,
            "start_time": _format_time_minutes(slot_start_mins),
            "end_time": _format_time_minutes(slot_end_mins),
            "window": "afternoon",
            "capacity": 30,
            "assigned_member_ids": [],
        })

    return slots


async def generate_all_event_slots(regenerate: bool = False) -> dict:
    events = await list_events()
    existing_slots = await load_all_slots()
    all_registrations = await load_registrations()
    
    # Calculate registration count per event
    reg_counts = {}
    for r in all_registrations:
        eids = r.get("event_ids") or [e.get("eventId") for e in r.get("eventRegistrations", []) if e.get("eventId")]
        for eid in eids:
            reg_counts[eid] = reg_counts.get(eid, 0) + 1

    existing_by_event = set(s.get("event_id") for s in existing_slots)

    if regenerate:
        try:
            if mongo.mongo_ready():
                await mongo.db.event_slots.delete_many({})
                await mongo.db.registrations.update_many({}, {"$set": {"assigned_slots": []}})
        except Exception:
            pass
        memory_event_slots.clear()
        for reg in memory_event_slots:
            reg["assigned_slots"] = []
        existing_by_event.clear()

    generated_per_event = {}
    for event in events:
        eid = event["id"]
        if not regenerate and eid in existing_by_event:
            count = sum(1 for s in existing_slots if s.get("event_id") == eid)
            generated_per_event[eid] = {
                "eventName": event["name"],
                "slotsCreated": 0,
                "existingSlots": count,
                "status": "already_exists",
            }
            continue

        count_for_ev = reg_counts.get(eid, 0)
        new_slots = generateSlotsForEvent(event, registration_count=count_for_ev)
        for slot in new_slots:
            await save_slot(slot)
        generated_per_event[eid] = {
            "eventName": event["name"],
            "slotsCreated": len(new_slots),
            "existingSlots": len(new_slots),
            "status": "generated",
        }

    # Automatically assign registered members if any exist
    try:
        await assignMembersToSlots()
    except Exception:
        pass

    return {
        "success": True,
        "message": f"Generated slots for {len(events)} events according to registration counts.",
        "details": generated_per_event,
    }


async def assignMembersToSlots() -> dict:
    global _last_assignment_summary
    events = await list_events()
    events_by_id = {e["id"]: e for e in events}
    
    slots = await load_all_slots()
    if not slots:
        # Auto-generate slots if not already generated
        await generate_all_event_slots()
        slots = await load_all_slots()

    # 1. Fetch all registrations (both pending & confirmed) where assigned_slots is still empty
    registrations = await load_registrations()
    unassigned_registrations = [
        r for r in registrations
        if not r.get("assigned_slots") or len(r.get("assigned_slots", [])) == 0
    ]

    def get_event_ids(r: dict) -> list[str]:
        if r.get("event_ids") and isinstance(r.get("event_ids"), list) and len(r.get("event_ids")) > 0:
            return r["event_ids"]
        return [e.get("eventId") for e in r.get("eventRegistrations", []) if e.get("eventId")]

    group_a = []
    group_b = []
    for r in unassigned_registrations:
        eids = get_event_ids(r)
        if len(eids) == 2:
            group_a.append(r)
        elif len(eids) == 1:
            group_b.append(r)

    slots_by_event: dict[str, list[dict]] = {}
    for s in slots:
        eid = s.get("event_id")
        if eid not in slots_by_event:
            slots_by_event[eid] = []
        slots_by_event[eid].append(s)

    successfully_assigned_ids = []
    unassigned_conflicts = []
    unassigned_full = []

    # 3. Process Group A (multi-event members)
    for reg in group_a:
        member_id = reg.get("registrationId") or reg.get("member_id")
        eids = get_event_ids(reg)
        ev_x, ev_y = eids[0], eids[1]

        if ev_x not in slots_by_event or not slots_by_event[ev_x]:
            new_s = await create_next_auto_slot(events_by_id.get(ev_x, {"id": ev_x}), [])
            slots_by_event[ev_x] = [new_s]
        if ev_y not in slots_by_event or not slots_by_event[ev_y]:
            new_s = await create_next_auto_slot(events_by_id.get(ev_y, {"id": ev_y}), [])
            slots_by_event[ev_y] = [new_s]

        slots_x = sorted(slots_by_event.get(ev_x, []), key=lambda s: len(s.get("assigned_member_ids", [])))
        slots_y = sorted(slots_by_event.get(ev_y, []), key=lambda s: len(s.get("assigned_member_ids", [])))

        pair_found = False
        for slot_x in slots_x:
            if len(slot_x.get("assigned_member_ids", [])) >= slot_x.get("capacity", 30):
                continue
            for slot_y in slots_y:
                if len(slot_y.get("assigned_member_ids", [])) >= slot_y.get("capacity", 30):
                    continue
                if not slotsConflict(slot_x, slot_y):
                    slot_x["assigned_member_ids"].append(member_id)
                    slot_y["assigned_member_ids"].append(member_id)
                    assigned = [slot_x["id"], slot_y["id"]]
                    await update_registration(member_id, {"assigned_slots": assigned})
                    await save_slot(slot_x)
                    await save_slot(slot_y)
                    successfully_assigned_ids.append(member_id)
                    pair_found = True
                    break
            if pair_found:
                break

        # If no pair found due to full capacity, dynamically create next slot
        if not pair_found:
            extra_slot_x = await create_next_auto_slot(events_by_id.get(ev_x, {"id": ev_x}), slots_by_event.get(ev_x, []))
            slots_by_event[ev_x].append(extra_slot_x)
            extra_slot_y = await create_next_auto_slot(events_by_id.get(ev_y, {"id": ev_y}), slots_by_event.get(ev_y, []))
            slots_by_event[ev_y].append(extra_slot_y)

            if not slotsConflict(extra_slot_x, extra_slot_y):
                extra_slot_x["assigned_member_ids"].append(member_id)
                extra_slot_y["assigned_member_ids"].append(member_id)
                assigned = [extra_slot_x["id"], extra_slot_y["id"]]
                await update_registration(member_id, {"assigned_slots": assigned})
                await save_slot(extra_slot_x)
                await save_slot(extra_slot_y)
                successfully_assigned_ids.append(member_id)
                pair_found = True

        if not pair_found:
            unassigned_conflicts.append(member_id)

    # 4. Process Group B (single-event members)
    for reg in group_b:
        member_id = reg.get("registrationId") or reg.get("member_id")
        eids = get_event_ids(reg)
        ev_single = eids[0]

        if ev_single not in slots_by_event or not slots_by_event[ev_single]:
            new_s = await create_next_auto_slot(events_by_id.get(ev_single, {"id": ev_single}), [])
            slots_by_event[ev_single] = [new_s]

        event_slots = sorted(slots_by_event.get(ev_single, []), key=lambda s: len(s.get("assigned_member_ids", [])))
        slot_found = False
        for slot in event_slots:
            if len(slot.get("assigned_member_ids", [])) < slot.get("capacity", 30):
                slot["assigned_member_ids"].append(member_id)
                assigned = [slot["id"]]
                await update_registration(member_id, {"assigned_slots": assigned})
                await save_slot(slot)
                successfully_assigned_ids.append(member_id)
                slot_found = True
                break

        if not slot_found:
            # Auto-create next slot on the fly
            new_slot = await create_next_auto_slot(events_by_id.get(ev_single, {"id": ev_single}), event_slots)
            slots_by_event[ev_single].append(new_slot)
            new_slot["assigned_member_ids"].append(member_id)
            assigned = [new_slot["id"]]
            await update_registration(member_id, {"assigned_slots": assigned})
            await save_slot(new_slot)
            successfully_assigned_ids.append(member_id)
            slot_found = True

    summary = {
        "total_processed": len(unassigned_registrations),
        "successfully_assigned": len(successfully_assigned_ids),
        "unassigned_conflicts": unassigned_conflicts,
        "unassigned_full": unassigned_full,
    }
    _last_assignment_summary = summary
    return summary


async def get_scheduler_dashboard_data() -> dict:
    events = await list_events()
    slots = await load_all_slots()
    all_registrations = await load_registrations()

    # If any registered members exist but have not been assigned, auto-assign
    unassigned = [r for r in all_registrations if not r.get("assigned_slots") or len(r.get("assigned_slots", [])) == 0]
    if unassigned:
        await assignMembersToSlots()
        slots = await load_all_slots()

    reg_counts_by_event: dict[str, int] = {}
    for r in all_registrations:
        eids = r.get("event_ids") or [e.get("eventId") for e in r.get("eventRegistrations", []) if e.get("eventId")]
        for eid in eids:
            reg_counts_by_event[eid] = reg_counts_by_event.get(eid, 0) + 1

    slots_by_event: dict[str, list[dict]] = {}
    for s in slots:
        eid = s.get("event_id")
        if eid not in slots_by_event:
            slots_by_event[eid] = []
        slots_by_event[eid].append(s)

    event_rows = []
    for ev in events:
        eid = ev["id"]
        ev_slots = slots_by_event.get(eid, [])
        event_rows.append({
            "id": eid,
            "name": ev["name"],
            "category": ev.get("category", "tech"),
            "duration_minutes": ev.get("duration_minutes", 90),
            "is_ctf": ev.get("is_ctf", False),
            "date": ev.get("date", "2026-09-26"),
            "total_registrations": reg_counts_by_event.get(eid, 0),
            "slots_count": len(ev_slots),
            "slots": sorted(ev_slots, key=lambda s: (0 if str(s.get("window")).lower() == "morning" else 1, s.get("start_time", ""))),
        })

    return {
        "events": event_rows,
        "total_slots": len(slots),
        "has_generated_slots": len(slots) > 0,
        "last_assignment_summary": _last_assignment_summary,
    }
