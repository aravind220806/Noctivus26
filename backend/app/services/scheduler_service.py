import math
from datetime import datetime, timezone

from app.db.memory_store import memory_event_slots
from app.events import EVENT_ALIASES
from app.db.sqlite_db import sqlite_db
from app.services.event_service import list_events, update_event
from app.services.registration_service import load_registrations, update_registration

_last_assignment_summary: dict | None = None
SINGLE_SLOT_EVENTS = {"ctf", "bug-hunt", "prompt-heist", "ignite"}
SCHEDULE_POLICY = "fixed-counts-conflict-repair-v1"


def required_slot_count(event_id: str) -> int:
    return 1 if event_id in SINGLE_SLOT_EVENTS else 2


def _get_event_ids(registration: dict) -> list[str]:
    """Robustly extract event IDs from a registration record.

    Checks `event_ids` (stored at creation) first, then falls back to reading
    from `eventRegistrations[*].eventId`. Deduplicates and strips empty strings.
    This ensures registrations always appear in scheduler counts regardless of
    which field is populated.
    """
    # Primary: event_ids list stored at registration time
    primary = [
        str(eid).strip()
        for eid in (registration.get("event_ids") or [])
        if eid and str(eid).strip()
    ]
    if primary:
        return list(dict.fromkeys(EVENT_ALIASES.get(eid, eid) for eid in primary))
    # Fallback: parse from eventRegistrations array
    return list(dict.fromkeys(
        EVENT_ALIASES.get(str(e["eventId"]).strip(), str(e["eventId"]).strip())
        for e in (registration.get("eventRegistrations") or [])
        if e.get("eventId") and str(e.get("eventId")).strip()
    ))


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


def _is_valid_time(value: str) -> bool:
    try:
        minutes = _parse_time_to_minutes(value)
    except (TypeError, ValueError, IndexError):
        return False
    return 0 <= minutes < 24 * 60


def _validate_slot_window(start_time: str, end_time: str) -> None:
    if not _is_valid_time(start_time) or not _is_valid_time(end_time):
        raise ValueError("Slot start and end time must be valid times.")
    if _parse_time_to_minutes(start_time) >= _parse_time_to_minutes(end_time):
        raise ValueError("Slot end time must be after start time.")


def slotsConflict(slotA: dict, slotB: dict) -> bool:
    if str(slotA.get("date") or "").strip() != str(slotB.get("date") or "").strip():
        return False
    start_a = _parse_time_to_minutes(slotA.get("start_time", "10:00"))
    end_a = _parse_time_to_minutes(slotA.get("end_time", "11:30"))
    start_b = _parse_time_to_minutes(slotB.get("start_time", "10:00"))
    end_b = _parse_time_to_minutes(slotB.get("end_time", "11:30"))

    if start_a < end_b and start_b < end_a:
        return True
    return False


def serialize_slot(slot: dict) -> dict:
    item = dict(slot)
    if "_id" in item:
        item["_id"] = str(item["_id"])
    return item


async def load_all_slots() -> list[dict]:
    if sqlite_db.ready():
        rows = await sqlite_db.list_all("event_slots")
        return [serialize_slot(s) for s in sorted(rows, key=lambda x: x.get("start_time", ""))]

    return [serialize_slot(s) for s in memory_event_slots]


async def save_slot(slot: dict) -> None:
    clean_slot = {k: v for k, v in slot.items() if k != "_id"}
    if sqlite_db.ready():
        await sqlite_db.upsert("event_slots", clean_slot["id"], clean_slot)
        return

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
                    clean_updates["capacity"] = max(1, min(300, int(v)))
                except (ValueError, TypeError):
                    pass
            elif k in ("start_time", "end_time"):
                clean_updates[k] = str(v).strip()
            elif k == "window":
                clean_updates["window"] = "afternoon" if str(v).lower() == "afternoon" else "morning"
            elif k == "date":
                clean_updates["date"] = str(v).strip()

    merged = {**slot, **clean_updates}
    if "capacity" in clean_updates:
        merged["auto_capacity"] = False
    _validate_slot_window(merged.get("start_time", ""), merged.get("end_time", ""))
    await save_slot(merged)
    await reconcile_slot_assignments()
    return merged


async def create_custom_slot(data: dict) -> dict:
    event_id = str(data.get("event_id") or "").strip()
    valid_event_ids = {event["id"] for event in await list_events()}
    if event_id not in valid_event_ids:
        raise ValueError("Select a valid event before creating a slot.")
    existing = [slot for slot in await load_all_slots() if slot["event_id"] == event_id]
    if len(existing) >= required_slot_count(event_id):
        raise ValueError(f"This event is limited to {required_slot_count(event_id)} slot(s). Edit its existing timings instead.")
    window = "afternoon" if str(data.get("window")).lower() == "afternoon" else "morning"
    start_time = str(data.get("start_time") or "10:00").strip()
    end_time = str(data.get("end_time") or "11:30").strip()
    _validate_slot_window(start_time, end_time)
    try:
        capacity = max(1, min(300, int(data.get("capacity") or 30)))
    except (TypeError, ValueError):
        raise ValueError("Slot capacity must be a number.") from None
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
        "schedule_policy": SCHEDULE_POLICY,
        "assigned_member_ids": [],
    }
    await save_slot(new_slot)
    return new_slot


async def _remove_slot(slot_id: str) -> bool:
    if sqlite_db.ready():
        return await sqlite_db.delete("event_slots", slot_id)
    for index, slot in enumerate(memory_event_slots):
        if slot.get("id") == slot_id:
            memory_event_slots.pop(index)
            return True
    return False


async def delete_slot(slot_id: str) -> bool:
    slot = await get_slot(slot_id)
    if not slot or not await _remove_slot(slot_id):
        return False
    remaining = [s for s in await load_all_slots() if s["event_id"] == slot["event_id"]]
    if remaining:
        rows = await load_registrations({"status": "confirmed"})
        count = sum(slot["event_id"] in _get_event_ids(reg) for reg in rows)
        for survivor in remaining:
            survivor["capacity"] = max(survivor.get("capacity", 30), math.ceil(count / len(remaining)))
            await save_slot(survivor)
        if len(remaining) in (1, 2):
            await update_event(slot["event_id"], {"slot_count": len(remaining)}, "scheduler")
    await reconcile_slot_assignments()
    await assignMembersToSlots(auto_generate=False)
    return True


async def configure_event_slots(event_id: str, count: int, updated_by: str) -> dict:
    if type(count) is not int or count != required_slot_count(event_id):
        raise ValueError(f"This event requires {required_slot_count(event_id)} slot(s).")
    events = await list_events()
    event = next((ev for ev in events if ev["id"] == event_id), None)
    if not event:
        raise ValueError("Select a valid event.")
    slots = await load_all_slots()
    event_slots = sorted([slot for slot in slots if slot["event_id"] == event_id],
                         key=lambda slot: (slot.get("date", ""), slot.get("start_time", "")))
    rows = await load_registrations()
    confirmed_count = sum(event_id in _get_event_ids(reg) for reg in await load_registrations({"status": "confirmed"}))
    # Keep existing timings when possible; add a second slot after the first.
    replacements = event_slots[:count]
    defaults = generateSlotsForEvent({**event, "slot_count": count}, confirmed_count)
    while len(replacements) < count:
        new_slot = defaults[len(replacements)]
        if replacements:
            start = max(780, _parse_time_to_minutes(replacements[0]["end_time"]))
            new_slot["date"] = replacements[0]["date"]
            new_slot["start_time"] = _format_time_minutes(start)
            new_slot["end_time"] = _format_time_minutes(start + int(event.get("duration_minutes") or 90))
        used_ids = {slot["id"] for slot in replacements}
        suffix = 1
        while new_slot["id"] in used_ids:
            new_slot["id"] = f"slot_{event_id}_split_{suffix}"
            suffix += 1
        replacements.append(new_slot)
    for slot in replacements:
        _validate_slot_window(slot["start_time"], slot["end_time"])
    await update_event(event_id, {"slot_count": count}, updated_by)
    old_ids = {slot["id"] for slot in event_slots}
    for reg in rows:
        current = reg.get("assigned_slots") or []
        if old_ids.intersection(current):
            await update_registration(reg.get("registrationId") or reg.get("member_id"),
                                      {"assigned_slots": [sid for sid in current if sid not in old_ids]})
    for slot in event_slots:
        await _remove_slot(slot["id"])
    for slot in replacements:
        slot["capacity"] = max(slot.get("capacity", 30), math.ceil(confirmed_count / count))
        slot["auto_capacity"] = True
        slot["schedule_policy"] = SCHEDULE_POLICY
        slot["assigned_member_ids"] = []
        await save_slot(slot)
    await reconcile_slot_assignments()
    summary = await assignMembersToSlots(auto_generate=False)
    return {"success": True, "slot_count": count, "assignment_summary": summary}


def generateSlotsForEvent(event: dict, registration_count: int = 0) -> list[dict]:
    duration = max(1, int(event.get("duration_minutes") or 90))
    count = required_slot_count(event["id"])
    capacity = max(30, registration_count)
    # Keep the requested slot count even when registrations increase.
    starts = [600] if count == 1 else [600, max(780, 600 + duration)]
    return [{
        "id": f"slot_{event['id']}_{'morning' if index == 0 else 'afternoon'}_1",
        "event_id": event["id"],
        "date": str(event.get("date") or "2026-09-26").strip(),
        "start_time": _format_time_minutes(start),
        "end_time": _format_time_minutes(start + duration),
        "window": "morning" if index == 0 else "afternoon",
        "capacity": capacity,
        "auto_capacity": True,
        "schedule_policy": SCHEDULE_POLICY,
        "assigned_member_ids": [],
    } for index, start in enumerate(starts)]


def plan_event_schedule(events: list[dict], registrations: list[dict]) -> list[dict]:
    """Build one/two sessions using the actual pairs of registered events.

    Single-session events with shared members are staggered. Each second
    session starts after its own first session and the first/only sessions
    of partnered events, so every two-event registration has a valid pair.
    Event dates and durations are preserved; no sessions overlap themselves.
    """
    by_event = {event["id"]: generateSlotsForEvent(event, sum(
        event["id"] in _get_event_ids(reg) for reg in registrations
    )) for event in events}
    neighbors = {eid: set() for eid in by_event}
    for reg in registrations:
        ids = [eid for eid in _get_event_ids(reg) if eid in by_event]
        for eid in ids:
            neighbors[eid].update(other for other in ids if other != eid)

    scheduled = {}
    singles = sorted((eid for eid in by_event if len(by_event[eid]) == 1),
                     key=lambda eid: (-len(neighbors[eid] & SINGLE_SLOT_EVENTS), eid))
    for eid in singles:
        slot = by_event[eid][0]
        duration = _parse_time_to_minutes(slot["end_time"]) - _parse_time_to_minutes(slot["start_time"])
        start = 600
        others = sorted((scheduled[other] for other in neighbors[eid] if other in scheduled
                         and scheduled[other]["date"] == slot["date"]), key=lambda other: other["start_time"])
        for other in others:
            other_start = _parse_time_to_minutes(other["start_time"])
            other_end = _parse_time_to_minutes(other["end_time"])
            if start < other_end and other_start < start + duration:
                start = other_end
        slot.update(start_time=_format_time_minutes(start), end_time=_format_time_minutes(start + duration),
                    window="morning" if start < 780 else "afternoon")
        scheduled[eid] = slot

    for eid, slots in by_event.items():
        if len(slots) != 2:
            continue
        first, second = slots
        duration = _parse_time_to_minutes(first["end_time"]) - _parse_time_to_minutes(first["start_time"])
        start = max(780, _parse_time_to_minutes(first["end_time"]), *[
            _parse_time_to_minutes(by_event[other][0]["end_time"])
            for other in neighbors[eid] if by_event[other][0]["date"] == first["date"]
        ])
        second.update(start_time=_format_time_minutes(start), end_time=_format_time_minutes(start + duration))
    planned = [slot for slots in by_event.values() for slot in slots]
    for slot in planned:
        _validate_slot_window(slot["start_time"], slot["end_time"])
    return planned


async def repair_event_schedule() -> dict:
    """Replace the old schedule only after a complete valid plan is ready."""
    events = await list_events()
    rows = await load_registrations()
    confirmed = await load_registrations({"status": "confirmed"})
    planned = plan_event_schedule(events, confirmed)
    for reg in rows:
        entries = [{key: value for key, value in entry.items() if key not in {"batchTime", "slotTiming"}}
                   for entry in reg.get("eventRegistrations") or []]
        await update_registration(reg.get("registrationId") or reg.get("member_id"),
                                  {"assigned_slots": [], "eventRegistrations": entries})
    for slot in await load_all_slots():
        await _remove_slot(slot["id"])
    for slot in planned:
        await save_slot(slot)
    for event in events:
        await update_event(event["id"], {"slot_count": required_slot_count(event["id"])}, "scheduler")
    summary = await assignMembersToSlots(auto_generate=False)
    summary["schedule_repaired"] = True
    summary["late_sessions"] = [
        {"event_id": slot["event_id"], "start_time": slot["start_time"], "end_time": slot["end_time"]}
        for slot in planned if _parse_time_to_minutes(slot["end_time"]) > 1020
    ]
    return summary


async def generate_all_event_slots(regenerate: bool = False) -> dict:
    summary = await repair_event_schedule()
    slots = await load_all_slots()
    return {
        "success": True,
        "message": "Applied event slot counts, repaired timings, and reassigned confirmed members.",
        "assignment_summary": summary,
        "details": {eid: {"slotsCreated": sum(slot["event_id"] == eid for slot in slots)}
                    for eid in {slot["event_id"] for slot in slots}},
    }


async def assignMembersToSlots(auto_generate: bool = True) -> dict:
    global _last_assignment_summary
    slots = await load_all_slots()
    if not slots and auto_generate:
        await generate_all_event_slots(regenerate=False)
        return _last_assignment_summary

    registrations = await load_registrations({"status": "confirmed"})
    by_id = {slot["id"]: slot for slot in slots}
    by_event: dict[str, list[dict]] = {}
    for slot in slots:
        by_event.setdefault(slot["event_id"], []).append(slot)

    counts: dict[str, int] = {}
    for reg in registrations:
        for eid in set(_get_event_ids(reg)):
            counts[eid] = counts.get(eid, 0) + 1
    for eid, event_slots in by_event.items():
        for slot in event_slots:
            capacity = max(slot.get("capacity", 30), counts.get(eid, 0))
            if slot.get("auto_capacity") and capacity != slot.get("capacity"):
                slot["capacity"] = capacity
                await save_slot(slot)

    pending = []
    for reg in registrations:
        event_ids = list(dict.fromkeys(_get_event_ids(reg)))
        assigned_events = {
            by_id[sid]["event_id"] for sid in reg.get("assigned_slots", []) if sid in by_id
        }
        current_slots = [by_id[sid] for sid in reg.get("assigned_slots", []) if sid in by_id]
        has_conflict = any(slotsConflict(left, right) for index, left in enumerate(current_slots)
                           for right in current_slots[index + 1:])
        if set(event_ids) - assigned_events or has_conflict:
            pending.append((reg, event_ids))
    # Assign members with multiple events first to leave more timing choices.
    pending.sort(key=lambda item: -len(item[1]))
    summary = {"total_processed": len(pending), "successfully_assigned": 0,
               "unassigned_conflicts": [], "unassigned_full": [],
               "late_sessions": [{"event_id": slot["event_id"], "start_time": slot["start_time"], "end_time": slot["end_time"]}
                                 for slot in slots if _parse_time_to_minutes(slot["end_time"]) > 1020]}
    for reg, event_ids in pending:
        member_id = reg.get("registrationId") or reg.get("member_id")
        current = [sid for sid in reg.get("assigned_slots", []) if sid in by_id]
        choices = []
        for eid in event_ids:
            available = [slot for slot in by_event.get(eid, [])
                         if len([mid for mid in slot.get("assigned_member_ids", []) if mid != member_id])
                         < slot.get("capacity", 30)]
            available.sort(key=lambda slot: (slot["id"] not in current,
                                            len(slot.get("assigned_member_ids", [])),
                                            slot.get("start_time", "")))
            choices.append(available)
        if any(not available for available in choices):
            summary["unassigned_full"].append(member_id)
            continue

        def choose(index: int, selected: list[dict]) -> list[dict] | None:
            if index == len(choices):
                return selected
            for slot in choices[index]:
                if all(not slotsConflict(slot, other) for other in selected):
                    result = choose(index + 1, selected + [slot])
                    if result is not None:
                        return result
            return None

        selected = choose(0, [])
        if selected is None:
            summary["unassigned_conflicts"].append(member_id)
            continue
        assigned = [slot["id"] for slot in selected]
        event_entries = []
        for entry in reg.get("eventRegistrations") or []:
            matched = next((slot for slot in selected if slot["event_id"] == EVENT_ALIASES.get(entry.get("eventId"), entry.get("eventId"))), None)
            event_entries.append({**entry, **({"batchTime": matched["start_time"],
                                               "slotTiming": f"{matched['start_time']} - {matched['end_time']}"} if matched else {})})
        await update_registration(member_id, {"assigned_slots": assigned, "eventRegistrations": event_entries})
        for sid in set(current + assigned):
            slot = by_id[sid]
            members = [mid for mid in slot.get("assigned_member_ids", []) if mid != member_id]
            if sid in assigned:
                members.append(member_id)
            slot["assigned_member_ids"] = members
            await save_slot(slot)
        summary["successfully_assigned"] += 1
    _last_assignment_summary = summary
    return summary


async def get_scheduler_dashboard_data() -> dict:
    events = await list_events()
    slots = await load_all_slots()
    # Upgrade existing schedules once; do not recreate slots deliberately deleted
    # from a schedule already using the current policy.
    if slots and any(slot.get("schedule_policy") != SCHEDULE_POLICY for slot in slots):
        await repair_event_schedule()
        events = await list_events()
        slots = await load_all_slots()
    all_registrations = await load_registrations({"status": "confirmed"})

    # Recompute from persisted state so another worker's old summary cannot
    # keep showing conflicts after a successful repair.
    summary = await assignMembersToSlots(auto_generate=False)
    slots = await load_all_slots()
    all_registrations = await load_registrations({"status": "confirmed"})
    unresolved = set(summary["unassigned_conflicts"] + summary["unassigned_full"])
    dashboard_summary = {
        **summary,
        "total_processed": len(all_registrations),
        "successfully_assigned": sum(
            bool(_get_event_ids(reg)) and (reg.get("registrationId") or reg.get("member_id")) not in unresolved
            for reg in all_registrations
        ),
    }

    reg_counts_by_event: dict[str, int] = {}
    for r in all_registrations:
        for eid in _get_event_ids(r):
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
            "slot_count": required_slot_count(eid),
            "slots": sorted(ev_slots, key=lambda s: (0 if str(s.get("window")).lower() == "morning" else 1, s.get("start_time", ""))),
        })

    return {
        "events": event_rows,
        "total_slots": len(slots),
        "has_generated_slots": len(slots) > 0,
        "last_assignment_summary": dashboard_summary,
    }


async def reconcile_slot_assignments() -> None:
    slots = await load_all_slots()
    by_id = {slot["id"]: slot for slot in slots}
    memberships = {sid: [] for sid in by_id}
    rows = await load_registrations()
    for reg in rows:
        current = reg.get("assigned_slots") or []
        assigned = list(dict.fromkeys(sid for sid in current if sid in by_id))
        member_id = reg.get("registrationId") or reg.get("member_id")
        for sid in assigned:
            memberships[sid].append(member_id)
        entries = []
        for entry in reg.get("eventRegistrations") or []:
            entry = dict(entry)
            slot = next((by_id[sid] for sid in assigned if by_id[sid]["event_id"] == EVENT_ALIASES.get(entry.get("eventId"), entry.get("eventId"))), None)
            if slot:
                entry.update(batchTime=slot["start_time"], slotTiming=f"{slot['start_time']} - {slot['end_time']}")
            else:
                entry.pop("batchTime", None)
                entry.pop("slotTiming", None)
            entries.append(entry)
        if assigned != current or entries != (reg.get("eventRegistrations") or []):
            await update_registration(member_id, {"assigned_slots": assigned, "eventRegistrations": entries})
    for slot in slots:
        if slot.get("assigned_member_ids", []) != memberships[slot["id"]]:
            slot["assigned_member_ids"] = memberships[slot["id"]]
            await save_slot(slot)
