from datetime import datetime, timezone

from app.core.config import settings
from app.db.memory_store import memory_events
from app.db import mongo
from app.db.sqlite_db import sqlite_db
from app.events import EVENT_CATALOG

VALID_STATUSES = {"open", "closed", "coming-soon"}


def _seed_events() -> list[dict]:
    return [
        {
            **event,
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
    return {key: event.get(key) for key in ("id", "name", "category", "duration_minutes", "is_ctf", "fee", "teamMin", "teamMax", "detailsComplete", "status", "autoCloseAt", "venue", "date", "time", "gate", "terminal", "seatType", "passActive")}


def serialize_event(event: dict) -> dict:
    item = dict(event)
    if "_id" in item:
        item["_id"] = str(item["_id"])
    return item


async def list_events() -> list[dict]:
    db_events = []
    try:
        if mongo.mongo_ready():
            rows = await mongo.db.events.find({}).sort("id", 1).to_list(length=100)
            if not rows:
                await seed_events()
                rows = await mongo.db.events.find({}).sort("id", 1).to_list(length=100)
            db_events = [serialize_event(row) for row in rows]
    except Exception as error:
        print(f"Falling back to SQLite/memory events: {error}")
        mongo.client = None
        mongo.db = None

    if not db_events and sqlite_db.ready():
        rows = await sqlite_db.list_all("events")
        if not rows:
            await seed_events()
            rows = await sqlite_db.list_all("events")
        if rows:
            db_events = [serialize_event(item) for item in rows]

    if not db_events:
        if not memory_events:
            memory_events.extend(_seed_events())
        db_events = [serialize_event(item) for item in memory_events]

    db_by_id = {e["id"]: e for e in db_events}
    for catalog_event in _seed_events():
        if catalog_event["id"] not in db_by_id:
            db_events.append(catalog_event)
            db_by_id[catalog_event["id"]] = catalog_event

    return db_events


async def seed_events() -> None:
    seeded = _seed_events()
    if mongo.mongo_ready():
        await mongo.db.events.create_index("id", unique=True)
        for event in seeded:
            await mongo.db.events.update_one(
                {"id": event["id"]},
                {"$set": {
                    "name": event["name"],
                    "category": event["category"],
                    "duration_minutes": event["duration_minutes"],
                    "is_ctf": event["is_ctf"],
                    "venue": event["venue"],
                    "date": event["date"],
                    "time": event["time"],
                    "gate": event["gate"],
                    "teamMin": event["teamMin"],
                    "teamMax": event["teamMax"],
                }, "$setOnInsert": event},
                upsert=True,
            )
    elif sqlite_db.ready():
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
    allowed = {"status", "fee", "teamMin", "teamMax", "autoCloseAt", "venue", "date", "time", "gate", "terminal", "seatType", "passActive", "duration_minutes", "category"}
    update = {key: value for key, value in changes.items() if key in allowed}
    if update.get("status") not in VALID_STATUSES and "status" in update:
        raise ValueError("Invalid event status.")
    if "fee" in update and (not isinstance(update["fee"], int) or update["fee"] < 0):
        raise ValueError("Fee must be a non-negative integer.")
    if "teamMin" in update and (not isinstance(update["teamMin"], int) or update["teamMin"] < 1):
        raise ValueError("Team minimum must be at least 1.")
    if "teamMax" in update and (not isinstance(update["teamMax"], int) or update["teamMax"] < 1):
        raise ValueError("Team maximum must be at least 1.")
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
    merged = {**current, **update, "updatedBy": updated_by, "updatedAt": datetime.now(timezone.utc).isoformat()}
    if merged["teamMin"] > merged["teamMax"]:
        raise ValueError("Team minimum cannot exceed team maximum.")
    if mongo.mongo_ready():
        clean_merged = dict(merged)
        clean_merged.pop("_id", None)
        await mongo.db.events.replace_one({"id": event_id}, clean_merged)
    elif sqlite_db.ready():
        await sqlite_db.upsert("events", event_id, merged)
    else:
        current.clear()
        current.update(merged)
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
