from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, ReturnDocument

from app.core.config import settings

client: AsyncIOMotorClient | None = None
db = None


async def connect_mongo() -> None:
    global client, db
    if not settings.mongodb_uri:
        db = None
        client = None
        return
    try:
        client = AsyncIOMotorClient(
            settings.mongodb_uri,
            maxPoolSize=settings.mongo_max_pool_size,
            minPoolSize=settings.mongo_min_pool_size,
            serverSelectionTimeoutMS=settings.mongo_server_selection_timeout_ms,
        )
        await client.admin.command("ping")
        db = client[settings.mongo_db_name]
        await db.registrations.create_index([("registrationId", ASCENDING)], unique=True)
        await db.registrations.create_index([("paymentStatus", ASCENDING), ("checkedIn", ASCENDING)])
        await db.registrations.create_index([("checkedInAt", DESCENDING)])
        await db.registrations.create_index([("normalizedUtr", ASCENDING)], unique=True, sparse=True)
        await db.registrations.create_index([("normalized.email", ASCENDING), ("eventRegistrations.eventId", ASCENDING)])
        await db.registrations.create_index([("normalized.email", ASCENDING)])
        await db.registrations.create_index([("eventRegistrations.eventId", ASCENDING)])
        await db.registrations.create_index([("paymentStatus", ASCENDING)])
        await db.admin_access.create_index([("email", ASCENDING)], unique=True)
        await db.admin_access.create_index([("updatedAt", DESCENDING)])
        await db.events.create_index([("id", ASCENDING)], unique=True)
        await db.event_schedules.create_index([("scheduleId", ASCENDING)], unique=True)
        await db.admin_actions.create_index([("createdAt", DESCENDING)])
        await db.email_jobs.create_index([("status", ASCENDING), ("nextAttemptAt", ASCENDING)])
        await db.pass_templates.create_index([("eventId", ASCENDING)], unique=True)
        await db.event_slots.create_index([("id", ASCENDING)], unique=True)
        await db.event_slots.create_index([("event_id", ASCENDING)])
        if settings.event_capacities:
            for event_id, capacity in settings.event_capacities.items():
                count = await db.registrations.count_documents({"eventRegistrations.eventId": event_id})
                await db.event_capacity.update_one(
                    {"eventId": event_id},
                    {"$set": {"capacity": capacity, "count": count}},
                    upsert=True,
                )
    except Exception as error:
        client = None
        db = None
        print(f"MongoDB connection failed: {error}")
        return


async def reserve_event_capacity(event_ids: list[str]) -> bool:
    if not settings.event_capacities or not mongo_ready():
        return True
    reserved: list[str] = []
    for event_id in event_ids:
        if event_id not in settings.event_capacities:
            continue
        result = await db.event_capacity.find_one_and_update(
            {"eventId": event_id, "$expr": {"$lt": ["$count", "$capacity"]}},
            {"$inc": {"count": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if result is None:
            for reserved_event_id in reserved:
                await db.event_capacity.update_one({"eventId": reserved_event_id}, {"$inc": {"count": -1}})
            return False
        reserved.append(event_id)
    return True


async def release_event_capacity(event_ids: list[str]) -> None:
    if not settings.event_capacities or not mongo_ready():
        return
    for event_id in event_ids:
        if event_id in settings.event_capacities:
            await db.event_capacity.update_one(
                {"eventId": event_id, "count": {"$gt": 0}},
                {"$inc": {"count": -1}},
            )


async def close_mongo() -> None:
    if client:
        client.close()


def mongo_ready() -> bool:
    return db is not None


async def storage_usage() -> dict:
    limit_bytes = settings.mongo_storage_limit_mb * 1024 * 1024
    if not mongo_ready():
        return {"available": False, "limitBytes": limit_bytes, "dataBytes": 0, "storageBytes": 0, "indexBytes": 0}
    try:
        stats = await db.command("dbStats", 1)
        return {
            "available": True,
            "limitBytes": limit_bytes,
            "dataBytes": int(stats.get("dataSize") or 0),
            "storageBytes": int(stats.get("storageSize") or 0),
            "indexBytes": int(stats.get("indexSize") or 0),
        }
    except Exception:
        # Some managed Mongo roles do not allow dbStats. Do not make the dashboard fail.
        return {"available": False, "limitBytes": limit_bytes, "dataBytes": 0, "storageBytes": 0, "indexBytes": 0}
