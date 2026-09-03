import asyncio
import hashlib
import secrets
import re
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.db.memory_store import memory_registrations
from app.db import mongo
from app.db.sqlite_db import sqlite_db
from app.services.event_service import list_events, public_event, _is_closed
from app.services.validation_service import normalize_digits, validate_registration


def create_registration_id() -> str:
    return f"NOC26-{secrets.token_hex(3).upper()}"


def create_qr_token() -> tuple[str, str]:
    """Return (qrToken, qrHash). Token has 144 bits of entropy — never derived from registrationId."""
    token = secrets.token_urlsafe(18)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


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
    elif sqlite_db.ready():
        duplicate = await sqlite_db.find_one("registrations", "normalizedUtr", utr_number)
    else:
        if settings.node_env == "production" or not settings.allow_memory_db:
            return 503, {"available": False, "message": "UTR verification is temporarily unavailable."}
        duplicate = next((item for item in memory_registrations if item.get("normalizedUtr") == utr_number), None)
    return 200, {"available": not bool(duplicate), "message": "This UTR has already been submitted." if duplicate else "UTR is available."}


async def create_registration(payload: dict | None, idempotency_key: str | None = None) -> tuple[int, dict]:
    configured_events = await list_events()
    if not settings.registration_open or any(not event.get("detailsComplete", True) for event in configured_events):
        return 403, {"message": "Registration is not open yet."}

    result = validate_registration(payload, configured_events)
    if not result["valid"]:
        return 400, {"message": result["errors"][0], "errors": result["errors"]}

    event_ids = [event["eventId"] for event in result["value"]["eventRegistrations"]]

    # Idempotency: return the original result if this key was already processed.
    if idempotency_key:
        if mongo.mongo_ready():
            existing = await mongo.db.registrations.find_one(
                {"idempotencyKey": idempotency_key}, {"registrationId": 1}
            )
        elif sqlite_db.ready():
            existing = await sqlite_db.find_one("registrations", "idempotencyKey", idempotency_key)
        else:
            existing = next((r for r in memory_registrations if r.get("idempotencyKey") == idempotency_key), None)
        if existing:
            return 200, {
                "registrationId": existing["registrationId"],
                "message": "Registration received and awaiting payment verification.",
            }

    now = datetime.now(timezone.utc)
    reg_id = create_registration_id()
    qr_token, qr_hash = create_qr_token()
    record = {
        "registrationId": reg_id,
        "member_id": reg_id,
        "event_ids": event_ids,
        "assigned_slots": [],
        "qrToken": qr_token,
        "qrHash": qr_hash,
        "idempotencyKey": idempotency_key,
        **result["value"],
        "paymentStatus": "pending",
        "payment_email_status": "not_attempted",
        "payment_email_error": None,
        "payment_email_sent_at": None,
        "pass_status": "not_sent",
        "pass_sent_at": None,
        "pass_failed_at": None,
        "pass_failure_reason": None,
        "paymentSubmittedAt": now.isoformat(),
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
    }

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
            if "idempotencyKey" in message:
                existing = await mongo.db.registrations.find_one({"idempotencyKey": idempotency_key}, {"registrationId": 1})
                if existing:
                    return 200, {"registrationId": existing["registrationId"], "message": "Registration received and awaiting payment verification."}
            return 409, {"message": "This UTR has already been submitted."}
    elif sqlite_db.ready():
        # Check for duplicate email+event
        all_regs = await sqlite_db.list_all("registrations")
        norm_email = result["value"]["normalized"]["email"]
        if any(
            r.get("normalized", {}).get("email") == norm_email
            and any(e.get("eventId") in event_ids for e in r.get("eventRegistrations", []))
            for r in all_regs
        ):
            return 409, {"message": "This email is already registered for one of the selected events."}
        if any(r.get("normalizedUtr") == result["value"]["normalizedUtr"] for r in all_regs):
            return 409, {"message": "This UTR has already been submitted."}
        await sqlite_db.upsert("registrations", reg_id, record)
    else:
        if settings.node_env == "production" or not settings.allow_memory_db:
            return 503, {"message": "Registration service is not connected to its database."}
        if any(r["normalized"]["email"] == result["value"]["normalized"]["email"] and any(e["eventId"] in event_ids for e in r.get("eventRegistrations", [])) for r in memory_registrations):
            return 409, {"message": "This email is already registered for one of the selected events."}
        if any(r.get("normalizedUtr") == result["value"]["normalizedUtr"] for r in memory_registrations):
            return 409, {"message": "This UTR has already been submitted."}
        memory_registrations.append(record)

    try:
        from app.services.scheduler_service import assignMembersToSlots
        asyncio.create_task(assignMembersToSlots())
    except Exception:
        pass

    return 201, {
        "registrationId": record["registrationId"],
        "message": "Registration received and awaiting payment verification.",
    }


async def load_registrations(filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    if mongo.mongo_ready():
        query = {}
        if filters.get("eventId"):
            query["eventRegistrations.eventId"] = filters["eventId"]
        if filters.get("status"):
            query["paymentStatus"] = filters["status"]
        if filters.get("pass_status"):
            if isinstance(filters["pass_status"], list):
                query["pass_status"] = {"$in": filters["pass_status"]}
            else:
                query["pass_status"] = filters["pass_status"]
        if filters.get("search"):
            term = re.escape(str(filters["search"]).strip()[:80])
            query["$or"] = [{"participant.name": {"$regex": term, "$options": "i"}}, {"participant.email": {"$regex": term, "$options": "i"}}, {"participant.phone": {"$regex": term, "$options": "i"}}, {"normalizedUtr": {"$regex": term}}]
        try:
            cursor = mongo.db.registrations.find(query).sort("createdAt", 1 if filters.get("sortAsc") else -1)
            rows = await cursor.to_list(length=5000)
            return rows
        except Exception as error:
            print(f"Mongo load failed, falling back to SQLite/memory: {error}")

    # --- SQLite path ---
    if sqlite_db.ready():
        order = "asc" if filters.get("sortAsc") else "desc"
        rows = await sqlite_db.list_all("registrations", order=order)
    else:
        rows = sorted(
            memory_registrations,
            key=lambda item: item.get("createdAt") or item.get("paymentSubmittedAt") or "",
            reverse=not filters.get("sortAsc"),
        )

    if filters.get("eventId"):
        rows = [item for item in rows if any(event.get("eventId") == filters["eventId"] for event in item.get("eventRegistrations", []))]
    if filters.get("status"):
        rows = [item for item in rows if item.get("paymentStatus") == filters["status"]]
    if filters.get("pass_status"):
        allowed_statuses = filters["pass_status"] if isinstance(filters["pass_status"], list) else [filters["pass_status"]]
        rows = [item for item in rows if (item.get("pass_status") or "not_sent") in allowed_statuses]
    if filters.get("search"):
        term = str(filters["search"]).lower()
        rows = [item for item in rows if term in f"{item.get('participant', {}).get('name', '')} {item.get('participant', {}).get('email', '')} {item.get('participant', {}).get('phone', '')} {item.get('normalizedUtr', '')}".lower()]
    return rows


async def update_registration(registration_id: str, update: dict) -> dict | None:
    update["updatedAt"] = datetime.now(timezone.utc).isoformat()
    if mongo.mongo_ready():
        try:
            return await mongo.db.registrations.find_one_and_update(
                {"registrationId": registration_id},
                {"$set": update},
                return_document=ReturnDocument.AFTER,
            )
        except Exception as error:
            print(f"Mongo registration update failed; falling back: {error}")
    if sqlite_db.ready():
        existing = await sqlite_db.get("registrations", registration_id)
        if existing:
            existing.update(update)
            await sqlite_db.upsert("registrations", registration_id, existing)
            return existing
        return None
    for registration in memory_registrations:
        if registration.get("registrationId") == registration_id:
            registration.update(update)
            return registration
    return None


def serialize_registration(registration: dict) -> dict:
    reg_id = registration.get("registrationId") or registration.get("member_id")
    event_ids = registration.get("event_ids") or [e.get("eventId") for e in registration.get("eventRegistrations", []) if e.get("eventId")]
    return {
        "registrationId": reg_id,
        "member_id": reg_id,
        "event_ids": event_ids,
        "assigned_slots": registration.get("assigned_slots") or [],
        "participant": registration.get("participant"),
        "eventRegistrations": registration.get("eventRegistrations"),
        "paymentStatus": registration.get("paymentStatus"),
        "payment_email_status": registration.get("payment_email_status") or "not_attempted",
        "payment_email_error": registration.get("payment_email_error"),
        "payment_email_sent_at": registration.get("payment_email_sent_at"),
        "pass_status": registration.get("pass_status") or "not_sent",
        "pass_sent_at": registration.get("pass_sent_at"),
        "pass_failed_at": registration.get("pass_failed_at"),
        "pass_failure_reason": registration.get("pass_failure_reason"),
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
        "attendance": registration.get("attendance"),
        "createdAt": registration.get("createdAt"),
    }
