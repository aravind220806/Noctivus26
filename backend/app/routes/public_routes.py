import hashlib
import json
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pymongo import ReturnDocument

from app.core.rate_limit import limiter
from app.core.config import settings
from app.db import mongo
from app.services.event_service import list_events
from app.services.cache_service import qr_lookup_cache, events_cache
from app.services.registration_service import (
    check_utr_availability,
    create_registration,
    load_registrations,
    registration_status,
    serialize_registration,
    update_registration,
)

router = APIRouter()


async def find_registration_by_qr_token(token: str) -> dict | None:
    """Public lookup — accepts only high-entropy QR tokens, never human registration IDs."""
    clean = token.strip()
    if clean.upper().startswith("NOC26-") or len(clean) < 12:
        return None

    parsed = urlparse(clean)
    if parsed.path:
        candidate = parsed.path.rstrip("/").split("/")[-1]
        if candidate:
            if candidate.upper().startswith("NOC26-") or len(candidate) < 12:
                return None
            clean = candidate

    cache_key = f"qr:{clean}"
    cached = qr_lookup_cache.get(cache_key)
    if cached is not None:
        return cached

    token_hash = hashlib.sha256(clean.encode("utf-8")).hexdigest()

    result = None
    if mongo.mongo_ready():
        result = await mongo.db.registrations.find_one({
            "$or": [
                {"invitation.qrHash": token_hash},
                {"invitation.qrHash": clean},
                {"invitation.qrToken": clean},
                {"qrHash": token_hash},
                {"qrToken": clean},
            ]
        })
    else:
        rows = await load_registrations()
        for item in rows:
            qr_hash = str((item.get("invitation") or {}).get("qrHash") or item.get("qrHash") or "")
            qr_token = str((item.get("invitation") or {}).get("qrToken") or item.get("qrToken") or "")
            if (qr_hash and qr_hash == token_hash) or (qr_token and qr_token == clean):
                result = item
                break

    if result:
        qr_lookup_cache.set(cache_key, result, ttl_seconds=120.0)
    return result


@router.get("/health")
async def health():
    from app.services.browser_renderer import renderer_available
    renderer_status = "ok" if await renderer_available() else "unavailable"
    if not mongo.mongo_ready():
        return {"status": "ok", "database": "memory", "passRenderer": renderer_status}
    if not await mongo.ping_mongo():
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "unavailable"},
        )
    return {"status": "ok", "database": "mongo", "passRenderer": renderer_status}


@router.get("/events")
async def events(request: Request, response: Response):
    data = events_cache.get("events_catalog")
    if data is None:
        data = await registration_status()
        events_cache.set("events_catalog", data, ttl_seconds=30.0)

    body_bytes = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    etag = f'W/"{hashlib.sha256(body_bytes).hexdigest()[:16]}"'

    client_etag = request.headers.get("if-none-match")
    if client_etag and client_etag.strip() == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": "public, max-age=30, stale-while-revalidate=120"})

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120"
    return data


@router.post("/utr/check")
@limiter.limit("60/minute")
async def utr_check(request: Request, response: Response):
    payload = await request.json()
    status_code, body = await check_utr_availability((payload or {}).get("utrNumber"))
    response.status_code = status_code
    return body


@router.post("/register")
@limiter.limit("30/minute")
async def register(request: Request, response: Response):
    idempotency_key = request.headers.get("idempotency-key") or None
    if idempotency_key and len(idempotency_key) > 128:
        raise HTTPException(status_code=400, detail="Idempotency-Key must be 128 characters or fewer.")
    status_code, body = await create_registration(await request.json(), idempotency_key=idempotency_key)
    response.status_code = status_code
    return body


@router.get("/p/{token_or_id}")
@limiter.limit("60/minute")
async def get_pass_details(request: Request, token_or_id: str):
    reg = await find_registration_by_qr_token(token_or_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Boarding pass not found or invalid.")

    events_list = await list_events()
    events_config = {e["id"]: e for e in events_list}
    reg_events = reg.get("eventRegistrations") or []

    event_details = []
    for re_entry in reg_events:
        eid = re_entry.get("eventId")
        cfg = events_config.get(eid) or {}
        event_details.append({
            "id": eid,
            "name": re_entry.get("eventName") or cfg.get("name") or "Noctivus '26",
            "category": re_entry.get("category") or cfg.get("category") or "Technical",
            "venue": cfg.get("venue") or re_entry.get("venue") or "Velammal Engineering College",
            "time": re_entry.get("batchTime") or cfg.get("time") or "09:00 AM",
            "gate": cfg.get("gate") or "VEC Gate 1",
            "terminal": cfg.get("terminal") or "MAIN HALL",
            "date": cfg.get("date") or "26 SEP 2026",
        })

    participant = reg.get("participant") or {}
    return {
        "valid": True,
        "registrationId": reg.get("registrationId"),
        "passengerName": participant.get("name") or "Participant",
        "college": participant.get("college") or "Velammal Engineering College",
        "paymentStatus": reg.get("paymentStatus") or "confirmed",
        "checkedIn": bool(reg.get("checkedIn")),
        "checkedInAt": reg.get("checkedInAt"),
        "selfCheckInEnabled": settings.public_self_checkin_enabled,
        "date": event_details[0]["date"] if event_details else "26 SEP 2026",
        "events": event_details,
    }


@router.post("/p/{token_or_id}/check-in")
@limiter.limit("20/minute")
async def public_check_in(request: Request, token_or_id: str):
    if not settings.public_self_checkin_enabled:
        raise HTTPException(status_code=403, detail="Self check-in is disabled. Please check in at the registration desk.")
    reg = await find_registration_by_qr_token(token_or_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found.")
    if reg.get("paymentStatus") != "confirmed":
        raise HTTPException(status_code=409, detail="Payment is not confirmed. Please visit the help desk.")
    if reg.get("checkedIn"):
        return {
            "status": "already-checked-in",
            "checkedInAt": reg.get("checkedInAt"),
            "registration": serialize_registration(reg),
        }

    checked_at = datetime.now(timezone.utc)
    reg_id = reg["registrationId"]
    if mongo.mongo_ready():
        checked = await mongo.db.registrations.find_one_and_update(
            {"registrationId": reg_id, "paymentStatus": "confirmed", "checkedIn": {"$ne": True}},
            {"$set": {"checkedIn": True, "checkedInAt": checked_at, "checkedInBy": "self", "updatedAt": checked_at}},
            return_document=ReturnDocument.AFTER,
        )
    else:
        checked = await update_registration(reg_id, {"checkedIn": True, "checkedInAt": checked_at, "checkedInBy": "self"})

    try:
        from app.services.google_sheets_service import google_sheets_service
        import asyncio
        asyncio.create_task(google_sheets_service.sync_check_in(checked or reg))
    except Exception:
        pass

    return {
        "status": "checked-in",
        "checkedInAt": checked_at,
        "registration": serialize_registration(checked or reg),
    }
