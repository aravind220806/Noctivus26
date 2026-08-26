import asyncio
import html

import httpx

from app.core.config import settings


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


def queue_email(coro):
    asyncio.create_task(_safe_email(coro))


async def _safe_email(coro):
    try:
        await coro
    except Exception as error:
        print(f"Email delivery failed: {error}")


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
        await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={"from": settings.confirm_from, "to": to_email, "subject": subject, "html": body},
        )


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

