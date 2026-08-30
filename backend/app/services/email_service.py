import asyncio
import base64
import html
import os
import re
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.utils import formataddr
from pathlib import Path
from collections.abc import Callable, Awaitable

import aiosmtplib
import httpx
from pymongo import ReturnDocument

from app.core.config import settings
from app.db import mongo
from app.services.boarding_pass_service import create_pass_token, render_pass_artwork_bytes
from app.services.event_service import get_event
from app.services.registration_service import update_registration


def normalize_pass_template(pass_data: dict | None) -> dict:
    data = pass_data or {}
    fields = []
    for field in data.get("fields") if isinstance(data.get("fields"), list) else []:
        row = {"label": str((field or {}).get("label") or "")[:40], "value": str((field or {}).get("value") or "")[:140]}
        if row["label"]:
            fields.append(row)
    return {
        "title": str(data.get("title") or "Noctivus 26 Event Pass")[:80],
        "eventId": str(data.get("eventId") or "")[:80],
        "eventName": str(data.get("eventName") or "")[:120],
        "venue": str(data.get("venue") or "")[:160],
        "date": str(data.get("date") or "")[:60],
        "time": str(data.get("time") or "")[:60],
        "gate": str(data.get("gate") or "")[:60],
        "terminal": str(data.get("terminal") or "")[:60],
        "seatType": str(data.get("seatType") or "VIP")[:40],
        "slotTiming": str(data.get("slotTiming") or "")[:80],
        "seatNumber": str(data.get("seatNumber") or "")[:40],
        "fields": fields[:14],
    }


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


async def generatePassImage(member: dict) -> str:
    participant = member.get("participant") or {}
    full_name = str(participant.get("name") or member.get("name") or "Member").strip()
    safe_name = re.sub(r"[^\w\s-]", "", full_name).strip().replace(" ", "_") or "Member"
    filename = f"Noctivus26_Pass_{safe_name}.png"

    temp_dir = Path("/tmp/passes")
    temp_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(temp_dir / filename)

    events = member.get("eventRegistrations") or []
    event_entry = events[0] if events else {}
    event_id = str(event_entry.get("eventId") or "")
    event_rec = (await get_event(event_id)) if event_id else None
    event_rec = event_rec or {}

    pass_data = {
        "title": f"Noctivus '26 Boarding Pass",
        "eventId": event_id,
        "eventName": str(event_entry.get("eventName") or event_rec.get("name") or "Noctivus '26"),
        "venue": str(event_rec.get("venue") or event_entry.get("venue") or "Main Auditorium"),
        "date": str(event_rec.get("date") or event_entry.get("date") or "26 SEP 2026"),
        "time": str(event_entry.get("batchTime") or event_rec.get("time") or event_entry.get("time") or "09:00 AM"),
        "gate": str(event_rec.get("gate") or "VEC Gate 1"),
        "terminal": str(event_rec.get("terminal") or "Main Hall"),
    }

    qr_token, qr_hash = create_pass_token()
    reg_id = member.get("registrationId")
    if reg_id:
        await update_registration(reg_id, {
            "qrToken": qr_token,
            "qrHash": qr_hash,
            "invitation": {
                "qrToken": qr_token,
                "qrHash": qr_hash,
                "status": "active",
                "sentAt": datetime.now(timezone.utc),
            },
        })
    image_bytes = await render_pass_artwork_bytes(member, pass_data, qr_token)

    with open(file_path, "wb") as f:
        f.write(image_bytes)

    return file_path


from app.services.receipt_service import generateReceiptImage


def build_confirmation_html(full_name: str, event_names_str: str) -> str:
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 16px;">
      <h1 style="margin: 0; font-size: 24px; color: #f59e0b; font-weight: 800; letter-spacing: -0.02em;">NOCTIVUS '26</h1>
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af;">Official Payment Verification</span>
    </div>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Hi <strong>{html.escape(full_name)}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">This is Noctivus '26. We've verified your payment for <strong>{html.escape(event_names_str)}</strong>.</p>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Your official <strong>Payment Receipt</strong> is attached to this email as an image for your records.</p>
    <div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
      <strong style="color: #93c5fd; display: block; font-size: 14px; margin-bottom: 4px;">✈ Boarding Pass Notice:</strong>
      <span style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">Your specific event time batch slot and official Symposium Boarding Pass will be dispatched via email once the event scheduler finalizes time allocations.</span>
    </div>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">Thank you for registering, and see you at the symposium!</p>
    <div style="border-top: 1px solid #1f2937; padding-top: 16px; font-size: 14px; color: #9ca3af;">
      — Team Noctivus '26
    </div>
  </div>
</body>
</html>"""


async def send_smtp_email(to_email: str, subject: str, html_body: str, attachment_path: str | None = None, attachment_name: str | None = None) -> None:
    sender_name = "Noctivus '26"
    sender_email = settings.smtp_from_email or "noctivus2026@gmail.com"
    from_header = formataddr((sender_name, sender_email))

    message = MIMEMultipart("mixed")
    message["From"] = from_header
    message["To"] = to_email
    message["Subject"] = subject

    html_part = MIMEText(html_body, "html", "utf-8")
    message.attach(html_part)

    if attachment_path and os.path.exists(attachment_path):
        with open(attachment_path, "rb") as f:
            img_data = f.read()
        image_part = MIMEImage(img_data, name=attachment_name or os.path.basename(attachment_path))
        image_part.add_header("Content-Disposition", "attachment", filename=attachment_name or os.path.basename(attachment_path))
        message.attach(image_part)

    if not settings.smtp_password:
        print(f"[SMTP Dev Simulation] Email to {to_email} (Subject: {subject}, Attached: {bool(attachment_path)}) - set SMTP_PASSWORD to send live.")
        return

    use_tls = settings.smtp_port == 465
    start_tls = settings.smtp_port == 587

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host or "smtp.gmail.com",
        port=settings.smtp_port or 465,
        username=settings.smtp_user or "noctivus2026@gmail.com",
        password=settings.smtp_password,
        use_tls=use_tls,
        start_tls=start_tls,
        timeout=25,
    )


async def sendPaymentConfirmationEmail(member: dict) -> dict:
    reg_id = str(member.get("registrationId") or member.get("member_id") or "")
    participant = member.get("participant") or {}
    full_name = str(participant.get("name") or member.get("name") or "Participant").strip()
    email = str(participant.get("email") or member.get("email") or "").strip()

    if not email:
        error_msg = "No email address on file"
        await update_registration(reg_id, {
            "payment_email_status": "failed",
            "payment_email_error": error_msg,
        })
        return {"success": False, "error": error_msg}

    events = member.get("eventRegistrations") or []
    event_names = [str(e.get("eventName") or e.get("eventId") or "").strip() for e in events if (e.get("eventName") or e.get("eventId"))]
    if len(event_names) == 2:
        event_names_str = f"{event_names[0]} and {event_names[1]}"
    elif len(event_names) == 1:
        event_names_str = event_names[0]
    else:
        event_names_str = "Noctivus '26 Events"

    receipt_image_path = None
    receipt_gen_failed = False
    receipt_error_note = None

    # Generate official Payment Receipt image
    try:
        receipt_image_path = await generateReceiptImage(member)
    except Exception as img_err:
        receipt_gen_failed = True
        receipt_error_note = "Receipt image generation failed, email sent without attachment"
        print(f"[Receipt Gen Error for {reg_id}]: {img_err}")

    subject = "Noctivus '26 — Payment Verified & Receipt ✅"
    html_content = build_confirmation_html(full_name, event_names_str)
    safe_name = re.sub(r"[^\w\s-]", "", full_name).strip().replace(" ", "_") or "Member"
    attachment_name = f"Noctivus26_Receipt_{safe_name}.png"

    try:
        await send_smtp_email(
            to_email=email,
            subject=subject,
            html_body=html_content,
            attachment_path=receipt_image_path if not receipt_gen_failed else None,
            attachment_name=attachment_name,
        )

        now = datetime.now(timezone.utc)
        status_updates = {
            "payment_email_status": "sent",
            "payment_email_sent_at": now,
            "payment_email_error": receipt_error_note,
        }
        await update_registration(reg_id, status_updates)
        print(f"[Payment Confirmation Receipt Email] Sent to {email} ({reg_id}) - Attached: {not receipt_gen_failed}")
        return {"success": True}
    except Exception as send_err:
        err_msg = str(send_err) or "SMTP delivery failed"
        await update_registration(reg_id, {
            "payment_email_status": "failed",
            "payment_email_error": err_msg,
        })
        print(f"[Payment Confirmation Email Failed for {reg_id}]: {err_msg}")
        return {"success": False, "error": err_msg}
    finally:
        if receipt_image_path and os.path.exists(receipt_image_path):
            try:
                os.remove(receipt_image_path)
            except Exception:
                pass


async def queue_email(kind: str, registration: dict, pass_data: dict | None = None) -> None:
    if kind == "confirmation":
        await sendPaymentConfirmationEmail(registration)
        return

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
    factory = lambda: send_invitation(registration, pass_data or {}) if kind == "invitation" else send_announcement(registration, pass_data or {}) if kind == "announcement" else sendPaymentConfirmationEmail(registration)
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
                await sendPaymentConfirmationEmail(job.get("registration") or {})
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


async def send_member_pass(registration: dict, admin_email: str = "") -> dict:
    participant = registration.get("participant") or {}
    name = str(participant.get("name") or "Member")
    email = str(participant.get("email") or "").strip()
    reg_id = str(registration.get("registrationId") or "")

    if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        reason = "Invalid or missing email address"
        now = datetime.now(timezone.utc)
        await update_registration(reg_id, {"pass_status": "failed", "pass_failure_reason": reason, "pass_failed_at": now})
        return {"success": False, "registrationId": reg_id, "name": name, "email": email, "reason": reason}

    try:
        events = registration.get("eventRegistrations") or []
        event_entry = events[0] if events else {}
        event_id = str(event_entry.get("eventId") or "")
        event_rec = (await get_event(event_id)) if event_id else None
        event_rec = event_rec or {}

        pass_data = normalize_pass_template({
            "title": f"Noctivus '26 Boarding Pass - {reg_id}",
            "eventId": event_id,
            "eventName": event_entry.get("eventName") or event_rec.get("name") or "Noctivus '26",
            "venue": event_rec.get("venue") or event_entry.get("venue") or "Main Auditorium",
            "date": event_rec.get("date") or "26 SEP 2026",
            "time": event_entry.get("batchTime") or event_rec.get("time") or "09:00 AM",
            "gate": event_rec.get("gate") or "VEC Gate 1",
            "terminal": event_rec.get("terminal") or "Main Hall",
        })

        qr_token, qr_hash = create_pass_token()
        artwork = await render_pass_artwork_bytes(registration, pass_data, qr_token)
        event_names = event_entry.get("eventName") or event_rec.get("name") or "Noctivus '26"

        safe_name = re.sub(r"[^\w\s-]", "", name).strip().replace(" ", "_") or "Member"
        temp_dir = Path("/tmp/passes")
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_img_file = str(temp_dir / f"Noctivus26_Pass_{safe_name}.png")
        with open(temp_img_file, "wb") as f:
            f.write(artwork)

        try:
            await send_smtp_email(
                to_email=email,
                subject=f"{pass_data['title']}",
                html_body=invitation_html(registration, pass_data, event_names, artwork),
                attachment_path=temp_img_file,
                attachment_name=f"Noctivus26_Pass_{safe_name}.png",
            )
        finally:
            if os.path.exists(temp_img_file):
                try:
                    os.remove(temp_img_file)
                except Exception:
                    pass

        now = datetime.now(timezone.utc)
        await update_registration(reg_id, {
            "pass_status": "sent",
            "pass_sent_at": now,
            "pass_failure_reason": None,
            "pass_failed_at": None,
            "invitation": {
                "sentAt": now,
                "sentBy": admin_email,
                "eventId": event_id,
                "passTitle": pass_data["title"],
                "qrHash": qr_hash,
                "status": "active",
            },
        })
        return {"success": True, "registrationId": reg_id, "name": name, "email": email}
    except Exception as error:
        reason = str(error) or "Email delivery error"
        now = datetime.now(timezone.utc)
        await update_registration(reg_id, {
            "pass_status": "failed",
            "pass_failure_reason": reason,
            "pass_failed_at": now,
        })
        return {"success": False, "registrationId": reg_id, "name": name, "email": email, "reason": reason}


async def send_invitation(registration: dict, pass_data: dict) -> None:
    participant = registration.get("participant") or {}
    email = str(participant.get("email") or "").strip()
    if not email:
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
    event_id = str(pass_data.get("eventId") or template_event_id)
    event_names = pass_tag_values(registration, event_id)["event"]
    artwork = await render_pass_artwork_bytes(registration, pass_data, token or None)

    temp_dir = Path("/tmp/passes")
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_file = str(temp_dir / f"pass_{registration.get('registrationId', 'preview')}.png")
    with open(temp_file, "wb") as f:
        f.write(artwork)

    try:
        await send_smtp_email(
            to_email=email,
            subject=f"{pass_data['title']} - {registration.get('registrationId')}",
            html_body=invitation_html(registration, pass_data, event_names, artwork),
            attachment_path=temp_file,
            attachment_name=f"noctivus-boarding-pass-{registration.get('registrationId')}.png",
        )
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass


async def send_confirmation(registration: dict) -> None:
    await sendPaymentConfirmationEmail(registration)


async def send_announcement(registration: dict, data: dict) -> None:
    participant = registration.get("participant") or {}
    email = str(participant.get("email") or "").strip()
    if not email:
        return
    subject = html.escape(str(data.get("subject") or "Noctivus announcement"))
    message = html.escape(str(data.get("message") or "")).replace("\\n", "<br>")
    await send_smtp_email(email, subject, f"<h1>{subject}</h1><p>{message}</p>")


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
