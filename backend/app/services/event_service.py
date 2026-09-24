from datetime import datetime, timezone

from app.core.config import settings
from app.db.memory_store import memory_events
from app.db.sqlite_db import sqlite_db
from app.events import EVENT_ALIASES, EVENT_CATALOG, EVENTS_BY_ID

VALID_STATUSES = {"open", "closed", "coming-soon"}
SOLO_TEAM_SIZE = 1


def _solo_event(event: dict) -> dict:
    if event.get("id") == "playground-of-hackers":
        event = {**event, "duration_minutes": 360, "time": "10:00", "slot_count": 1}
    return {**event, "teamMin": SOLO_TEAM_SIZE, "teamMax": SOLO_TEAM_SIZE}


def _is_canonical_event(event: dict) -> bool:
    return str((event or {}).get("id") or "") not in EVENT_ALIASES


def _seed_events() -> list[dict]:
    return [
        {
            **_solo_event(event),
            "status": event.get("status", "open"),
            "terminal": event.get("terminal", "MAIN HALL"),
            "seatType": event.get("seatType", "VIP"),
            "passActive": event.get("passActive", True),
            "duration_minutes": event.get("duration_minutes", 90),
            "is_ctf": event.get("is_ctf", False),
            "autoCloseAt": None,
            "updatedBy": "system",
            "updatedAt": None,
        }
        for event in EVENT_CATALOG
    ]


def _is_closed(event: dict, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    auto_close = event.get("autoCloseAt")
    if event.get("status") == "open" and auto_close:
        if isinstance(auto_close, str):
            auto_close = datetime.fromisoformat(auto_close.replace("Z", "+00:00"))
        if auto_close.tzinfo is None:
            auto_close = auto_close.replace(tzinfo=timezone.utc)
        return auto_close <= now
    return event.get("status") == "closed"


def public_event(event: dict) -> dict:
    solo = _solo_event(event)
    return {key: solo.get(key) for key in ("id", "name", "category", "duration_minutes", "is_ctf", "fee", "teamMin", "teamMax", "detailsComplete", "status", "autoCloseAt", "venue", "date", "time", "gate", "terminal", "seatType", "passActive")}


def serialize_event(event: dict) -> dict:
    item = dict(event)
    if "_id" in item:
        item["_id"] = str(item["_id"])
    return item


async def list_events() -> list[dict]:
    db_events = []
    if sqlite_db.ready():
        rows = await sqlite_db.list_all("events")
        if not rows:
            await seed_events()
            rows = await sqlite_db.list_all("events")
        if rows:
            db_events = [_solo_event(serialize_event(item)) for item in rows]

    if not db_events:
        if not memory_events:
            memory_events.extend(_seed_events())
        db_events = [_solo_event(serialize_event(item)) for item in memory_events]

    db_by_id = {e["id"]: e for e in db_events}
    for catalog_event in _seed_events():
        if catalog_event["id"] not in db_by_id:
            db_events.append(catalog_event)
            db_by_id[catalog_event["id"]] = catalog_event

    # Apply the renamed title to existing stored events as well as new seeds.
    for event in db_events:
        if event.get("id") == "ipl-bidverse":
            event["name"] = EVENTS_BY_ID["ipl-bidverse"]["name"]

    return [event for event in db_events if _is_canonical_event(event)]


async def seed_events() -> None:
    seeded = _seed_events()
    if sqlite_db.ready():
        for event in seeded:
            existing = await sqlite_db.get("events", event["id"])
            if not existing:
                await sqlite_db.upsert("events", event["id"], event)
    else:
        for event in seeded:
            if not any(e["id"] == event["id"] for e in memory_events):
                memory_events.append(event)


async def get_event(event_id: str) -> dict | None:
    events = await list_events()
    return next((event for event in events if event.get("id") == event_id), None)


async def update_event(event_id: str, changes: dict, updated_by: str) -> dict | None:
    allowed = {"status", "fee", "autoCloseAt", "venue", "date", "time", "gate", "terminal", "seatType", "passActive", "duration_minutes", "category", "slot_count"}
    update = {key: value for key, value in changes.items() if key in allowed}
    if update.get("status") not in VALID_STATUSES and "status" in update:
        raise ValueError("Invalid event status.")
    if "fee" in update and (not isinstance(update["fee"], int) or update["fee"] < 0):
        raise ValueError("Fee must be a non-negative integer.")
    if "slot_count" in update and (type(update["slot_count"]) is not int or update["slot_count"] not in (1, 2)):
        raise ValueError("Choose one or two slots.")
    if "duration_minutes" in update:
        try:
            update["duration_minutes"] = max(15, int(update["duration_minutes"]))
        except (ValueError, TypeError):
            pass
    for key in ("venue", "date", "time", "gate", "terminal", "seatType"):
        if key in update:
            update[key] = str(update[key] or "").strip()[:160]
    if "passActive" in update:
        update["passActive"] = update["passActive"] is not False
    current = await get_event(event_id)
    if not current:
        return None
    merged = _solo_event({**current, **update, "updatedBy": updated_by, "updatedAt": datetime.now(timezone.utc).isoformat()})
    if sqlite_db.ready():
        await sqlite_db.upsert("events", event_id, merged)
    else:
        for index, event in enumerate(memory_events):
            if event.get("id") == event_id:
                memory_events[index] = merged
                break
        else:
            memory_events.append(merged)
    from app.services.cache_service import events_cache
    events_cache.clear()
    return serialize_event(merged)


async def admin_events() -> list[dict]:
    events = await list_events()
    from app.services.registration_service import load_registrations
    all_registrations = await load_registrations()
    
    result = []
    for event in events:
        eid = event["id"]
        count = sum(
            1 for r in all_registrations
            if any(e.get("eventId") == eid for e in r.get("eventRegistrations", [])) or eid in (r.get("event_ids") or [])
        )
        result.append(serialize_event({
            **event,
            "registrationCount": count,
            "effectiveStatus": "closed" if _is_closed(event) else event.get("status"),
        }))
    return result
