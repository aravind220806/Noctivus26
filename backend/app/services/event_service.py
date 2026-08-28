from datetime import datetime, timezone

from app.core.config import settings
from app.db.memory_store import memory_events
from app.db import mongo
from app.events import EVENT_CATALOG

VALID_STATUSES = {"open", "closed", "coming-soon"}


def _seed_events() -> list[dict]:
    return [{**event, "status": event.get("status", "open"), "autoCloseAt": None, "updatedBy": "system", "updatedAt": None} for event in EVENT_CATALOG]


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
    return {key: event.get(key) for key in ("id", "name", "category", "fee", "teamMin", "teamMax", "detailsComplete", "status", "autoCloseAt", "venue", "date", "time", "gate")}


async def list_events() -> list[dict]:
    if mongo.mongo_ready():
        rows = await mongo.db.events.find({}).sort("id", 1).to_list(length=100)
        if not rows:
            await seed_events()
            rows = await mongo.db.events.find({}).sort("id", 1).to_list(length=100)
        return rows
    if not memory_events:
        memory_events.extend(_seed_events())
    return memory_events


async def seed_events() -> None:
    seeded = _seed_events()
    if mongo.mongo_ready():
        await mongo.db.events.create_index("id", unique=True)
        for event in seeded:
            await mongo.db.events.update_one({"id": event["id"]}, {"$setOnInsert": event}, upsert=True)
    elif not memory_events:
        memory_events.extend(seeded)


async def get_event(event_id: str) -> dict | None:
    events = await list_events()
    return next((event for event in events if event.get("id") == event_id), None)


async def update_event(event_id: str, changes: dict, updated_by: str) -> dict | None:
    allowed = {"status", "fee", "teamMin", "teamMax", "autoCloseAt", "venue", "date", "time", "gate"}
    update = {key: value for key, value in changes.items() if key in allowed}
    if update.get("status") not in VALID_STATUSES and "status" in update:
        raise ValueError("Invalid event status.")
    if "fee" in update and (not isinstance(update["fee"], int) or update["fee"] < 0):
        raise ValueError("Fee must be a non-negative integer.")
    if "teamMin" in update and (not isinstance(update["teamMin"], int) or update["teamMin"] < 1):
        raise ValueError("Team minimum must be at least 1.")
    if "teamMax" in update and (not isinstance(update["teamMax"], int) or update["teamMax"] < 1):
        raise ValueError("Team maximum must be at least 1.")
    current = await get_event(event_id)
    if not current:
        return None
    merged = {**current, **update, "updatedBy": updated_by, "updatedAt": datetime.now(timezone.utc)}
    if merged["teamMin"] > merged["teamMax"]:
        raise ValueError("Team minimum cannot exceed team maximum.")
    if mongo.mongo_ready():
        await mongo.db.events.replace_one({"id": event_id}, merged)
    else:
        current.clear()
        current.update(merged)
    return merged


async def admin_events() -> list[dict]:
    events = await list_events()
    result = []
    for event in events:
        if mongo.mongo_ready():
            count = await mongo.db.registrations.count_documents({"eventRegistrations.eventId": event["id"]})
        else:
            count = 0
        result.append({**event, "registrationCount": count, "effectiveStatus": "closed" if _is_closed(event) else event.get("status")})
    return result
