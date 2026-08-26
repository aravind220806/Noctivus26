from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, ReturnDocument

from app.core.config import settings

client: AsyncIOMotorClient | None = None
db = None


async def connect_mongo() -> None:
    global client, db
    if not settings.mongodb_uri:
        return
    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        maxPoolSize=settings.mongo_max_pool_size,
        minPoolSize=settings.mongo_min_pool_size,
        serverSelectionTimeoutMS=settings.mongo_server_selection_timeout_ms,
    )
    await client.admin.command("ping")
    db = client[settings.mongo_db_name]
    await db.registrations.create_index([("registrationId", ASCENDING)], unique=True)
    await db.registrations.create_index([("normalizedUtr", ASCENDING)], unique=True, sparse=True)
    await db.registrations.create_index([("normalized.email", ASCENDING), ("eventRegistrations.eventId", ASCENDING)], unique=True)
    await db.registrations.create_index([("normalized.email", ASCENDING)])
    await db.registrations.create_index([("eventRegistrations.eventId", ASCENDING)])
    await db.registrations.create_index([("paymentStatus", ASCENDING)])
    await db.admin_access.create_index([("email", ASCENDING)], unique=True)
    await db.admin_access.create_index([("updatedAt", DESCENDING)])
    await db.email_jobs.create_index([("status", ASCENDING), ("nextAttemptAt", ASCENDING)])
    if settings.event_capacities:
        for event_id, capacity in settings.event_capacities.items():
            count = await db.registrations.count_documents({"eventRegistrations.eventId": event_id})
            await db.event_capacity.update_one(
                {"eventId": event_id},
                {"$set": {"capacity": capacity, "count": count}},
                upsert=True,
            )


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
