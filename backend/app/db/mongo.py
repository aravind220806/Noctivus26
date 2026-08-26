from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING

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


async def close_mongo() -> None:
    if client:
        client.close()


def mongo_ready() -> bool:
    return db is not None
