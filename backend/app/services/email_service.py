import asyncio
import base64
import html
import re
from datetime import datetime, timedelta, timezone
from collections.abc import Callable, Awaitable

import httpx
from pymongo import ReturnDocument

from app.core.config import settings
from app.db import mongo
from app.services.boarding_pass_service import render_pass_artwork_bytes


def normalize_pass_template(pass_data: dict | None) -> dict:
    data = pass_data or {}
    fields = []
    for field in data.get("fields") if isinstance(data.get("fields"), list) else []:
        row = {"label": str((field or {}).get("label") or "")[:40], "value": str((field or {}).get("value") or "")[:140]}
        if row["label"]:
            fields.append(row)
    return {"title": str(data.get("title") or "Noctivus 26 Event Pass")[:80], "eventId": str(data.get("eventId") or "")[:80], "eventName": str(data.get("eventName") or "")[:120], "venue": str(data.get("venue") or "")[:160], "date": str(data.get("date") or "")[:60], "time": str(data.get("time") or "")[:60], "gate": str(data.get("gate") or "")[:60], "terminal": str(data.get("terminal") or "")[:60], "seatType": str(data.get("seatType") or "VIP")[:40], "fields": fields[:14]}


def pass_tag_values(registration: dict, event_id: str = "") -> dict[str, str]:
    participant = registration.get("participant") or {}
    events = registration.get("eventRegistrations") or []
    event = next((item for item in events if item.get("eventId") == event_id), events[0] if events else {})
    return {
        "name": str(participant.get("name") or ""),
        "college": str(participant.get("college") or ""),
        "email": str(participant.get("email") or ""),
        "phone": str(participant.get("phone") or ""),
        "event": str(event.get("eventName") or "Noctivus 26"),
        "eventId": str(event.get("eventId") or ""),
        "category": str(event.get("category") or ""),
        "registrationId": str(registration.get("registrationId") or ""),
        "amount": str(registration.get("expectedAmount") or event.get("feeSnapshot") or ""),
        "date": str(event.get("date") or "26 SEP 2026"),
        "time": str(event.get("time") or "09:00 AM"),
        "gate": str(event.get("gate") or "VEC Gate 1"),
        "venue": str(event.get("venue") or "Main Auditorium"),
        "flight": str(event.get("flight") or "NV26"),
        "seat": str(event.get("seat") or "VIP"),
        "zone": str(event.get("zone") or "1"),
        "terminal": str(event.get("terminal") or "Main Hall"),
        "fromCollege": str(participant.get("college") or ""),
        "foodPreference": str(participant.get("foodPreference") or "N/A"),
        "toVenue": "Velammal Engineering College",
    }


def resolve_pass_tags(value: object, registration: dict, event_id: str = "") -> str:
    values = pass_tag_values(registration, event_id)
    return re.sub(r"{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}", lambda match: values.get(match.group(1), match.group(0)), str(value or ""))


MAX_EMAIL_ATTEMPTS = 3
EMAIL_JOB_RETENTION_DAYS = 30


async def queue_email(kind: str, registration: dict, pass_data: dict | None = None) -> None:
    if mongo.mongo_ready():
        await mongo.db.email_jobs.insert_one({
            "kind": kind,
            "registration": registration,
            "passData": pass_data,
            "status": "pending",
            "attempts": 0,
            "nextAttemptAt": datetime.now(timezone.utc),
        })
        return
    factory = lambda: send_invitation(registration, pass_data or {}) if kind == "invitation" else send_announcement(registration, pass_data or {}) if kind == "announcement" else send_confirmation(registration)
    asyncio.create_task(_safe_email(factory))


async def _safe_email(email_factory: Callable[[], Awaitable[None]]) -> None:
    for attempt in range(MAX_EMAIL_ATTEMPTS):
        try:
            await email_factory()
            return
        except Exception as error:
            if attempt == MAX_EMAIL_ATTEMPTS - 1:
                print(f"Email delivery failed after {MAX_EMAIL_ATTEMPTS} attempts: {error}")
                return
            await asyncio.sleep(0.5 * (2**attempt))


async def email_worker(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        if not mongo.mongo_ready():
            await asyncio.sleep(1)
            continue
        job = await mongo.db.email_jobs.find_one_and_update(
            {"status": "pending", "nextAttemptAt": {"$lte": datetime.now(timezone.utc)}},
            {"$set": {"status": "processing"}},
            sort=[("nextAttemptAt", 1)],
            return_document=ReturnDocument.AFTER,
        )
        if not job:
            await asyncio.sleep(1)
            continue
        try:
            if job.get("kind") == "invitation":
                await send_invitation(job.get("registration") or {}, job.get("passData") or {})
            elif job.get("kind") == "announcement":
                await send_announcement(job.get("registration") or {}, job.get("passData") or {})
            else:
                await send_confirmation(job.get("registration") or {})
            now = datetime.now(timezone.utc)
            await mongo.db.email_jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "sent", "sentAt": now, "expiresAt": now + timedelta(days=EMAIL_JOB_RETENTION_DAYS)}})
        except Exception as error:
            attempts = int(job.get("attempts", 0)) + 1
            update = {"attempts": attempts, "error": str(error)[:500]}
            if attempts >= MAX_EMAIL_ATTEMPTS:
                update["status"] = "failed"
                update["expiresAt"] = datetime.now(timezone.utc) + timedelta(days=EMAIL_JOB_RETENTION_DAYS)
            else:
                update["status"] = "pending"
                update["nextAttemptAt"] = datetime.now(timezone.utc) + timedelta(seconds=0.5 * (2 ** (attempts - 1)))
            await mongo.db.email_jobs.update_one({"_id": job["_id"]}, {"$set": update})


async def send_invitation(registration: dict, pass_data: dict) -> None:
    if not settings.resend_api_key or not settings.confirm_from:
        return
    template_event_id = str(pass_data.get("templateEventId") or "")
    token = str(pass_data.get("qrToken") or "")
    if template_event_id and mongo.mongo_ready():
        template = await mongo.db.pass_templates.find_one({"eventId": template_event_id}, {"pass": 1})
        pass_data = (template or {}).get("pass") or {}
    assigned_time = pass_data.get("assignedTime")
    pass_data = normalize_pass_template(pass_data)
    if assigned_time:
        pass_data["time"] = str(assigned_time)
    participant = registration.get("participant") or {}
    event_id = str(pass_data.get("eventId") or template_event_id)
    event_names = pass_tag_values(registration, event_id)["event"]
    artwork = await render_pass_artwork_bytes(registration, pass_data, token or None)
    await _send_email(participant.get("email"), f"{pass_data['title']} - {registration.get('registrationId')}", invitation_html(registration, pass_data, event_names, artwork), attachments=[{"filename": f"noctivus-boarding-pass-{registration.get('registrationId')}.png", "content": base64.b64encode(artwork).decode("ascii")}])


async def send_confirmation(registration: dict) -> None:
    if not settings.resend_api_key or not settings.confirm_from:
        return
    participant = registration.get("participant") or {}
    body = f"<h1>You're confirmed, {html.escape(str(participant.get('name') or ''))}.</h1><p>Your Noctivus '26 registration <strong>{html.escape(str(registration.get('registrationId') or ''))}</strong> is confirmed.</p>"
    await _send_email(participant.get("email"), f"Noctivus '26 registration confirmed - {registration.get('registrationId')}", body)


async def send_announcement(registration: dict, data: dict) -> None:
    if not settings.resend_api_key or not settings.confirm_from:
        return
    participant = registration.get("participant") or {}
    subject = html.escape(str(data.get("subject") or "Noctivus announcement"))
    message = html.escape(str(data.get("message") or "")).replace("\\n", "<br>")
    await _send_email(participant.get("email"), subject, f"<h1>{subject}</h1><p>{message}</p>")


async def _send_email(to_email: str, subject: str, body: str, attachments: list[dict] | None = None) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={"from": settings.confirm_from, "to": to_email, "subject": subject, "html": body, **({"attachments": attachments} if attachments else {})},
        )
        response.raise_for_status()


def invitation_html(registration: dict, pass_data: dict, event_names: str, artwork: bytes | None = None) -> str:
    participant = registration.get("participant") or {}
    fields = [
        ("Passenger", participant.get("name")),
        ("Event", event_names),
        ("Date", pass_data.get("date")),
        ("Time", pass_data.get("time")),
        ("Gate", pass_data.get("gate")),
        ("Terminal", pass_data.get("terminal")),
        ("From", participant.get("college")),
        ("Registration ID", registration.get("registrationId")),
        *[(resolve_pass_tags(field["label"], registration, pass_data.get("eventId", "")), resolve_pass_tags(field["value"], registration, pass_data.get("eventId", ""))) for field in pass_data["fields"]],
    ]
    rows = "".join(f"<tr><th style=\"text-align:left;padding:10px;border-bottom:1px solid #ddd\">{html.escape(str(label or ''))}</th><td style=\"padding:10px;border-bottom:1px solid #ddd\">{html.escape(str(value or ''))}</td></tr>" for label, value in fields)
    venue = html.escape(str(pass_data.get("venue") or "Velammal Engineering College"))
    rows += f"<tr><th style=\"text-align:left;padding:10px;border-bottom:1px solid #ddd\">Venue</th><td style=\"padding:10px;border-bottom:1px solid #ddd\">{venue}</td></tr>"
    image = ""
    if artwork:
        image = f"<img src=\"data:image/png;base64,{base64.b64encode(artwork).decode('ascii')}\" alt=\"Personalized Noctivus 26 boarding pass\" style=\"width:100%;max-height:280px;object-fit:cover;border-radius:10px\">"
    return f"<div style=\"font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111\"><h1>{html.escape(pass_data['title'])}</h1>{image}<p>Your personalized boarding pass is attached. Present its QR code at check-in.</p><table style=\"width:100%;border-collapse:collapse\">{rows}</table></div>"


def render_pass_artwork(registration: dict, pass_data: dict) -> str:
    raise RuntimeError("Use render_pass_artwork_bytes asynchronously for generated boarding passes.")
