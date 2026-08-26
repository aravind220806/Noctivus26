import asyncio
import html
from datetime import datetime, timedelta, timezone
from collections.abc import Callable, Awaitable

import httpx
from pymongo import ReturnDocument

from app.core.config import settings
from app.db import mongo


def normalize_pass_template(pass_data: dict | None) -> dict:
    data = pass_data or {}
    image_data_url = str(data.get("imageDataUrl") or "")
    if not image_data_url.startswith("data:image/"):
        image_data_url = ""
    fields = []
    for field in data.get("fields") if isinstance(data.get("fields"), list) else []:
        row = {"label": str((field or {}).get("label") or "")[:40], "value": str((field or {}).get("value") or "")[:140]}
        if row["label"]:
            fields.append(row)
    return {"title": str(data.get("title") or "Noctivus 26 Event Pass")[:80], "imageDataUrl": image_data_url[:900000], "fields": fields[:10]}


MAX_EMAIL_ATTEMPTS = 3


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
    factory = lambda: send_invitation(registration, pass_data or {}) if kind == "invitation" else send_confirmation(registration)
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
            else:
                await send_confirmation(job.get("registration") or {})
            await mongo.db.email_jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "sent", "sentAt": datetime.now(timezone.utc)}})
        except Exception as error:
            attempts = int(job.get("attempts", 0)) + 1
            update = {"attempts": attempts, "error": str(error)[:500]}
            if attempts >= MAX_EMAIL_ATTEMPTS:
                update["status"] = "failed"
            else:
                update["status"] = "pending"
                update["nextAttemptAt"] = datetime.now(timezone.utc) + timedelta(seconds=0.5 * (2 ** (attempts - 1)))
            await mongo.db.email_jobs.update_one({"_id": job["_id"]}, {"$set": update})


async def send_invitation(registration: dict, pass_data: dict) -> None:
    if not settings.resend_api_key or not settings.confirm_from:
        return
    participant = registration.get("participant") or {}
    event_names = ", ".join(event.get("eventName", "") for event in registration.get("eventRegistrations", [])) or "Noctivus 26"
    await _send_email(participant.get("email"), f"{pass_data['title']} - {registration.get('registrationId')}", invitation_html(registration, pass_data, event_names))


async def send_confirmation(registration: dict) -> None:
    if not settings.resend_api_key or not settings.confirm_from:
        return
    participant = registration.get("participant") or {}
    body = f"<h1>You're confirmed, {html.escape(str(participant.get('name') or ''))}.</h1><p>Your Noctivus '26 registration <strong>{html.escape(str(registration.get('registrationId') or ''))}</strong> is confirmed.</p>"
    await _send_email(participant.get("email"), f"Noctivus '26 registration confirmed - {registration.get('registrationId')}", body)


async def _send_email(to_email: str, subject: str, body: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={"from": settings.confirm_from, "to": to_email, "subject": subject, "html": body},
        )
        response.raise_for_status()


def invitation_html(registration: dict, pass_data: dict, event_names: str) -> str:
    participant = registration.get("participant") or {}
    fields = [
        ("Name", participant.get("name")),
        ("College", participant.get("college")),
        ("Event", event_names),
        ("Registration ID", registration.get("registrationId")),
        *[(field["label"], field["value"]) for field in pass_data["fields"]],
    ]
    rows = "".join(f"<tr><th style=\"text-align:left;padding:10px;border-bottom:1px solid #ddd\">{html.escape(str(label or ''))}</th><td style=\"padding:10px;border-bottom:1px solid #ddd\">{html.escape(str(value or ''))}</td></tr>" for label, value in fields)
    image = f"<img src=\"{pass_data['imageDataUrl']}\" alt=\"\" style=\"width:100%;max-height:280px;object-fit:cover;border-radius:10px\">" if pass_data["imageDataUrl"] else ""
    return f"<div style=\"font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111\"><h1>{html.escape(pass_data['title'])}</h1>{image}<p>Your Noctivus '26 event pass is ready.</p><table style=\"width:100%;border-collapse:collapse\">{rows}</table></div>"
