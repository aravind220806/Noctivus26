import asyncio
import hashlib
import logging
import secrets
import re
from datetime import datetime, timezone

from app.core.config import settings
from app.db.memory_store import memory_registrations
from app.events import EVENT_ALIASES
from app.db.sqlite_db import sqlite_db
from app.services.event_service import list_events, public_event, _is_closed
from app.services.validation_service import normalize_digits, validate_registration

logger = logging.getLogger(__name__)


def is_trashed(registration: dict | None) -> bool:
    return bool(registration and registration.get("trashedAt"))


def create_registration_id() -> str:
    """Return a human-readable registration ID with 60+ bits of cryptographic entropy.

    Format: NOC26-{base62-10chars}
    The 10-character suffix provides ~60 bits of entropy (62^10 ≈ 8.39 × 10^17),
    making brute-force mathematically impossible while remaining human-scannable.
    """
    import string
    import secrets

    alphabet = string.digits + string.ascii_uppercase + string.ascii_lowercase
    suffix = ''.join(secrets.choice(alphabet) for _ in range(10))
    return f"NOC26-{suffix}"


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
        "events": [{**public_event(event), "status": "closed" if _is_closed(event) else "open" if registration_open and event.get("status") == "open" else "opening-soon"} for event in configured_events],
    }


async def check_utr_availability(input_value) -> tuple[int, dict]:
    utr_number = normalize_digits(input_value)
    if not __import__("re").match(r"^\d{12}$", utr_number):
        return 400, {"available": False, "message": "Enter exactly 12 digits."}

    if sqlite_db.ready():
        duplicate = await sqlite_db.find_one("registrations", "normalizedUtr", utr_number)
        if is_trashed(duplicate):
            duplicate = None
    else:
        if settings.node_env == "production" or not settings.allow_memory_db:
            return 503, {"available": False, "message": "UTR verification is temporarily unavailable."}
        duplicate = next(
            (
                item
                for item in memory_registrations
                if item.get("normalizedUtr") == utr_number and not is_trashed(item)
            ),
            None,
        )
    return 200, {"available": not bool(duplicate), "message": "This UTR has already been submitted." if duplicate else "UTR is available."}


async def create_registration(payload: dict | None, idempotency_key: str | None = None) -> tuple[int, dict]:
    configured_events = await list_events()
    if not settings.registration_open or any(not event.get("detailsComplete", True) for event in configured_events):
        return 403, {"message": "Registration is not open yet."}

    submitted_events = (payload or {}).get("events", [])
    selected_ids = set()
    for item in submitted_events if isinstance(submitted_events, list) else []:
        event_id = item.get("eventId") if isinstance(item, dict) else item
        if isinstance(event_id, str):
            selected_ids.add(EVENT_ALIASES.get(event_id, event_id))
    closed_events = [event for event in configured_events if event["id"] in selected_ids and _is_closed(event)]
    if closed_events:
        return 403, {
            "code": "EVENT_CLOSED",
            "eventIds": [event["id"] for event in closed_events],
            "message": "Event closed due to high registration. Please contact the event coordinator.",
        }

    result = validate_registration(payload, configured_events)
    if not result["valid"]:
        return 400, {"message": result["errors"][0], "errors": result["errors"]}

    event_ids = [event["eventId"] for event in result["value"]["eventRegistrations"]]

    # Idempotency: return the original result if this key was already processed.
    if idempotency_key:
        if sqlite_db.ready():
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

    if sqlite_db.ready():
        # Check for duplicate email+event
        all_regs = await sqlite_db.list_all("registrations")
        norm_email = result["value"]["normalized"]["email"]
        if any(
            r.get("normalized", {}).get("email") == norm_email
            and not is_trashed(r)
            and any(e.get("eventId") in event_ids for e in r.get("eventRegistrations", []))
            for r in all_regs
        ):
            return 409, {"message": "This email is already registered for one of the selected events."}
        if any(r.get("normalizedUtr") == result["value"]["normalizedUtr"] and not is_trashed(r) for r in all_regs):
            return 409, {"message": "This UTR has already been submitted."}
        await sqlite_db.upsert("registrations", reg_id, record)
    else:
        if settings.node_env == "production" or not settings.allow_memory_db:
            return 503, {"message": "Registration service is not connected to its database."}
        if any(
            r["normalized"]["email"] == result["value"]["normalized"]["email"]
            and not is_trashed(r)
            and any(e["eventId"] in event_ids for e in r.get("eventRegistrations", []))
            for r in memory_registrations
        ):
            return 409, {"message": "This email is already registered for one of the selected events."}
        if any(
            r.get("normalizedUtr") == result["value"]["normalizedUtr"] and not is_trashed(r)
            for r in memory_registrations
        ):
            return 409, {"message": "This UTR has already been submitted."}
        memory_registrations.append(record)

    try:
        from app.services.scheduler_service import assignMembersToSlots
        asyncio.create_task(assignMembersToSlots())
    except Exception:
        pass

    sheets_synced = None
    sheets_error = None
    try:
        from app.services.google_sheets_service import google_sheets_service
        sheets_synced = await asyncio.wait_for(google_sheets_service.sync_new_registration(record), timeout=15)
        status = google_sheets_service.get_status()
        if not sheets_synced:
            sheets_error = status.get("lastError") or "Google Sheets sync is not enabled or not configured."
            logger.error("Google Sheets sync did not complete for registration %s: %s", reg_id, sheets_error)
    except Exception as err:
        sheets_synced = False
        sheets_error = str(err)
        logger.exception("Google Sheets sync failed for registration %s", reg_id)

    return 201, {
        "registrationId": record["registrationId"],
        "message": "Registration received and awaiting payment verification.",
        "sheetsSynced": sheets_synced,
        "sheetsError": sheets_error,
    }


async def load_registrations(filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    # --- SQLite path ---
    if sqlite_db.ready():
        order = "asc" if filters.get("sortAsc") else "desc"
        rows = await sqlite_db.list_all("registrations", order=order)
        sqlite_ids = {r.get("registrationId") for r in rows if r.get("registrationId")}
        for mem in memory_registrations:
            if mem.get("registrationId") not in sqlite_ids:
                rows.append(mem)
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

    if filters.get("trashedOnly"):
        rows = [item for item in rows if is_trashed(item)]
    elif not filters.get("includeTrashed"):
        rows = [item for item in rows if not is_trashed(item)]

    return rows


async def _remove_members_from_slots(member_ids: set[str]) -> None:
    if not member_ids:
        return

    if sqlite_db.ready():
        slots = await sqlite_db.list_all("event_slots")
        for slot in slots:
            assigned = slot.get("assigned_member_ids") or []
            if not assigned:
                continue
            filtered = [mid for mid in assigned if mid not in member_ids]
            if len(filtered) != len(assigned):
                slot["assigned_member_ids"] = filtered
                await sqlite_db.upsert("event_slots", slot["id"], slot)

    try:
        from app.db.memory_store import memory_event_slots
        for slot in memory_event_slots:
            assigned = slot.get("assigned_member_ids") or []
            if assigned:
                slot["assigned_member_ids"] = [mid for mid in assigned if mid not in member_ids]
    except Exception:
        pass


async def hard_delete_registration(registration_id: str) -> bool:
    deleted = False
    if sqlite_db.ready():
        deleted = await sqlite_db.delete("registrations", registration_id) or deleted

    before = len(memory_registrations)
    memory_registrations[:] = [item for item in memory_registrations if item.get("registrationId") != registration_id]
    deleted = deleted or len(memory_registrations) < before

    if deleted:
        try:
            from app.services.cache_service import qr_lookup_cache, events_cache
            qr_lookup_cache.clear()
            events_cache.clear()
        except Exception:
            pass
    return deleted


async def trash_registrations(registration_ids: list[str], trashed_by: str | None = None) -> int:
    now = datetime.now(timezone.utc).isoformat()
    trashed_ids: list[str] = []
    for registration_id in registration_ids:
        existing = None
        if sqlite_db.ready():
            existing = await sqlite_db.get("registrations", registration_id)
        if not existing:
            existing = next((item for item in memory_registrations if item.get("registrationId") == registration_id), None)
        if not existing or is_trashed(existing):
            continue
        updated = await update_registration(
            registration_id,
            {
                "trashedAt": now,
                "trashedBy": trashed_by,
                "assigned_slots": [],
            },
        )
        if updated:
            trashed_ids.append(registration_id)

    await _remove_members_from_slots(set(trashed_ids))
    return len(trashed_ids)


async def restore_registrations(registration_ids: list[str]) -> int:
    restored = 0
    for registration_id in registration_ids:
        existing = None
        if sqlite_db.ready():
            existing = await sqlite_db.get("registrations", registration_id)
        if not existing:
            existing = next((item for item in memory_registrations if item.get("registrationId") == registration_id), None)
        if not existing or not is_trashed(existing):
            continue
        updated = await update_registration(
            registration_id,
            {
                "trashedAt": None,
                "trashedBy": None,
            },
        )
        if updated:
            restored += 1
    return restored


async def empty_registration_trash() -> int:
    trashed = await load_registrations({"trashedOnly": True})
    deleted = 0
    for registration in trashed:
        registration_id = registration.get("registrationId")
        if registration_id and await hard_delete_registration(registration_id):
            deleted += 1
    await _remove_members_from_slots({r.get("registrationId") for r in trashed if r.get("registrationId")})
    return deleted


async def update_registration(registration_id: str, update: dict) -> dict | None:
    update["updatedAt"] = datetime.now(timezone.utc).isoformat()
    result = None
    if sqlite_db.ready():
        existing = await sqlite_db.get("registrations", registration_id)
        if existing:
            existing.update(update)
            await sqlite_db.upsert("registrations", registration_id, existing)
            result = existing
    else:
        for registration in memory_registrations:
            if registration.get("registrationId") == registration_id:
                registration.update(update)
                result = registration
                break

    try:
        from app.services.cache_service import qr_lookup_cache, events_cache
        qr_lookup_cache.clear()
        events_cache.clear()
    except Exception:
        pass

    return result


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
        "createdAt": registration.get("createdAt"),
        "trashedAt": registration.get("trashedAt"),
        "trashedBy": registration.get("trashedBy"),
    }
