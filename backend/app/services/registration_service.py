import secrets
import re
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.db.memory_store import memory_registrations
from app.db import mongo
from app.services.event_service import list_events, public_event, _is_closed
from app.services.validation_service import normalize_digits, validate_registration


def create_registration_id() -> str:
    return f"NOC26-{secrets.token_hex(3).upper()}"


async def registration_status() -> dict:
    configured_events = await list_events()
    registration_open = settings.registration_open and all(event.get("detailsComplete", True) for event in configured_events)
    return {
        "registrationOpen": registration_open,
        "events": [{**public_event(event), "status": "open" if registration_open and not _is_closed(event) else "opening-soon"} for event in configured_events],
    }


async def check_utr_availability(input_value) -> tuple[int, dict]:
    utr_number = normalize_digits(input_value)
    if not __import__("re").match(r"^\d{12}$", utr_number):
        return 400, {"available": False, "message": "Enter exactly 12 digits."}

    if mongo.mongo_ready():
        duplicate = await mongo.db.registrations.find_one({"normalizedUtr": utr_number}, {"_id": 1})
    else:
        if settings.node_env == "production" or not settings.allow_memory_db:
            return 503, {"available": False, "message": "UTR verification is temporarily unavailable."}
        duplicate = next((item for item in memory_registrations if item.get("normalizedUtr") == utr_number), None)
    return 200, {"available": not bool(duplicate), "message": "This UTR has already been submitted." if duplicate else "UTR is available."}


async def create_registration(payload: dict | None) -> tuple[int, dict]:
    configured_events = await list_events()
    if not settings.registration_open or any(not event.get("detailsComplete", True) for event in configured_events):
        return 403, {"message": "Registration is not open yet."}

    result = validate_registration(payload, configured_events)
    if not result["valid"]:
        return 400, {"message": result["errors"][0], "errors": result["errors"]}

    event_ids = [event["eventId"] for event in result["value"]["eventRegistrations"]]
    now = datetime.now(timezone.utc)
    record = {"registrationId": create_registration_id(), **result["value"], "paymentStatus": "pending", "paymentSubmittedAt": now, "createdAt": now, "updatedAt": now}

    if mongo.mongo_ready():
        if not await mongo.reserve_event_capacity(event_ids):
            return 409, {"message": "One of the selected events has reached capacity."}
        duplicate = await mongo.db.registrations.find_one({"normalized.email": result["value"]["normalized"]["email"], "eventRegistrations.eventId": {"$in": event_ids}}, {"_id": 1})
        if duplicate:
            await mongo.release_event_capacity(event_ids)
            return 409, {"message": "This email is already registered for one of the selected events."}
        try:
            await mongo.db.registrations.insert_one(record)
        except DuplicateKeyError as error:
            await mongo.release_event_capacity(event_ids)
            message = str(error)
            if "normalized.email" in message or "eventRegistrations.eventId" in message:
                return 409, {"message": "This email is already registered for one of the selected events."}
            return 409, {"message": "This UTR has already been submitted."}
    else:
        if settings.node_env == "production" or not settings.allow_memory_db:
            return 503, {"message": "Registration service is not connected to its database."}
        for event_id in event_ids:
            capacity = settings.event_capacities.get(event_id)
            if capacity is not None:
                used = sum(1 for item in memory_registrations if any(event.get("eventId") == event_id for event in item.get("eventRegistrations", [])))
                if used >= capacity:
                    return 409, {"message": "One of the selected events has reached capacity."}
        duplicate_event = any(item.get("normalized", {}).get("email") == result["value"]["normalized"]["email"] and any(event.get("eventId") in event_ids for event in item.get("eventRegistrations", [])) for item in memory_registrations)
        if duplicate_event:
            return 409, {"message": "This email is already registered for one of the selected events."}
        if any(item.get("normalizedUtr") == result["value"]["normalizedUtr"] for item in memory_registrations):
            return 409, {"message": "This UTR has already been submitted."}
        memory_registrations.append(record)

    return 201, {
        "registrationId": record["registrationId"],
        "status": "pending",
        "expectedAmount": record["expectedAmount"],
        "message": "Registration received and awaiting payment verification.",
    }


async def load_registrations(filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    query = {}
    if filters.get("eventId"):
        query["eventRegistrations.eventId"] = filters["eventId"]
    if filters.get("status"):
        query["paymentStatus"] = filters["status"]
    if filters.get("search"):
        term = re.escape(str(filters["search"]).strip()[:80])
        query["$or"] = [{"participant.name": {"$regex": term, "$options": "i"}}, {"participant.email": {"$regex": term, "$options": "i"}}, {"participant.phone": {"$regex": term, "$options": "i"}}, {"normalizedUtr": {"$regex": term}}]

    if mongo.mongo_ready():
        cursor = mongo.db.registrations.find(query).sort("createdAt", -1)
        rows = await cursor.to_list(length=5000)
    else:
        rows = sorted(memory_registrations, key=lambda item: item.get("createdAt") or item.get("paymentSubmittedAt") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        if filters.get("eventId"):
            rows = [item for item in rows if any(event.get("eventId") == filters["eventId"] for event in item.get("eventRegistrations", []))]
        if filters.get("status"):
            rows = [item for item in rows if item.get("paymentStatus") == filters["status"]]
        if filters.get("search"):
            term = str(filters["search"]).lower()
            rows = [item for item in rows if term in f"{item.get('participant', {}).get('name', '')} {item.get('participant', {}).get('email', '')} {item.get('participant', {}).get('phone', '')} {item.get('normalizedUtr', '')}".lower()]
    return rows


async def update_registration(registration_id: str, update: dict) -> dict | None:
    if mongo.mongo_ready():
        update["updatedAt"] = datetime.now(timezone.utc)
        return await mongo.db.registrations.find_one_and_update({"registrationId": registration_id}, {"$set": update}, return_document=ReturnDocument.AFTER)
    for registration in memory_registrations:
        if registration.get("registrationId") == registration_id:
            registration.update(update)
            registration["updatedAt"] = datetime.now(timezone.utc)
            return registration
    return None


def serialize_registration(registration: dict) -> dict:
    return {
        "registrationId": registration.get("registrationId"),
        "participant": registration.get("participant"),
        "eventRegistrations": registration.get("eventRegistrations"),
        "paymentStatus": registration.get("paymentStatus"),
        "utrNumber": registration.get("utrNumber"),
        "paymentReference": registration.get("paymentReference"),
        "expectedAmount": registration.get("expectedAmount"),
        "claimedAmount": registration.get("claimedAmount"),
        "paymentSubmittedAt": registration.get("paymentSubmittedAt"),
        "verifiedAt": registration.get("verifiedAt"),
        "verifiedBy": registration.get("verifiedBy"),
        "checkedIn": registration.get("checkedIn", False),
        "checkedInAt": registration.get("checkedInAt"),
        "checkedInBy": registration.get("checkedInBy"),
        "isWalkIn": registration.get("isWalkIn", False),
        "verificationNotes": registration.get("verificationNotes"),
        "invitation": registration.get("invitation"),
        "createdAt": registration.get("createdAt"),
    }
