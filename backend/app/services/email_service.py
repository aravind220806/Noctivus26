import asyncio
import base64
import html
import os
import re
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from email.utils import formataddr, make_msgid
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


from app.services.receipt_service import render_receipt_artwork_bytes, generateReceiptImage


def build_confirmation_html(full_name: str, event_names_str: str, cid: str | None = None) -> str:
    receipt_img_tag = ""
    if cid:
        receipt_img_tag = f"""
        <div style="margin: 24px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #1f2937;">
          <img src="cid:{cid}" alt="Noctivus '26 Official Payment Receipt" style="display: block; width: 100%; max-width: 600px; margin: 0 auto;" />
        </div>
        """

    # Google Calendar link for 26 Sep 2026 8:30 AM – 6 PM IST (UTC+5:30)
    # 20260926T030000Z = 08:30 IST, 20260926T123000Z = 18:00 IST
    gcal_url = (
        "https://calendar.google.com/calendar/render?action=TEMPLATE"
        "&text=Noctivus+%2726+%E2%80%94+National+Symposium"
        "&dates=20260926T030000Z%2F20260926T123000Z"
        "&details=I+am+registered+for+Noctivus+%2726+%E2%80%94+National+Level+Technical+Symposium+by+Department+of+CSE+(Cyber+Security)%2C+Velammal+Engineering+College."
        "&location=Velammal+Engineering+College%2C+Ambattur-Redhills+Road%2C+Surapet%2C+Chennai+%E2%80%94+600066"
        "&sf=true&output=xml"
    )
    # ICS data URI for generic calendar apps (Outlook, Apple Calendar, etc.)
    ics_content = (
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Noctivus 26//EN\r\n"
        "BEGIN:VEVENT\r\n"
        "DTSTART:20260926T030000Z\r\n"
        "DTEND:20260926T123000Z\r\n"
        "SUMMARY:Noctivus '26 — National Symposium\r\n"
        "DESCRIPTION:I am registered for Noctivus '26 — National Level Technical Symposium by Department of CSE (Cyber Security)\\, Velammal Engineering College.\r\n"
        "LOCATION:Velammal Engineering College\\, Ambattur-Redhills Road\\, Surapet\\, Chennai — 600066\r\n"
        "STATUS:CONFIRMED\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR"
    )
    import base64 as _b64
    ics_data_uri = "data:text/calendar;charset=utf-8;base64," + _b64.b64encode(ics_content.encode("utf-8")).decode("ascii")

    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Verification - Noctivus '26</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="margin-bottom: 24px; border-bottom: 1px solid #1f2937; padding-bottom: 16px;">
      <h1 style="margin: 0; font-size: 24px; color: #00c8e0; font-weight: 800; letter-spacing: -0.02em;">NOCTIVUS '26</h1>
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af;">Official Payment Verification</span>
    </div>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Hi <strong>{html.escape(full_name)}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Welcome to <strong>Noctivus '26</strong>! We have verified your registration fee payment for <strong>{html.escape(event_names_str)}</strong>.</p>
    
    <div style="background: rgba(0, 200, 224, 0.08); border-left: 4px solid #00c8e0; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
      <strong style="color: #67e8f9; display: block; font-size: 14px; margin-bottom: 4px;">📅 Next Steps &amp; Event Pass:</strong>
      <span style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">Your official <strong>Symposium Event Pass</strong> with check-in QR code will be dispatched in a separate email once scheduling is finalized.</span>
    </div>

    <!-- Add to Calendar buttons -->
    <div style="margin: 20px 0; display: flex; gap: 10px; flex-wrap: wrap;">
      <a href="{gcal_url}" target="_blank"
         style="display: inline-flex; align-items: center; gap: 7px; background: #1a73e8; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.01em;">
        📅 Add to Google Calendar
      </a>
      <a href="{ics_data_uri}" download="Noctivus26.ics"
         style="display: inline-flex; align-items: center; gap: 7px; background: #1e293b; color: #e2e8f0; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; border: 1px solid #334155; letter-spacing: 0.01em;">
        📆 Add to Outlook / Apple Calendar
      </a>
    </div>

    <p style="font-size: 14px; font-weight: 700; color: #e5e7eb; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Official Payment Receipt:</p>
    {receipt_img_tag}

    <p style="font-size: 14px; line-height: 1.6; color: #9ca3af; margin: 24px 0 20px;">Thank you for registering. See you on <strong>26 September 2026</strong> at Velammal Engineering College!</p>
    <div style="border-top: 1px solid #1f2937; padding-top: 16px; font-size: 13px; color: #6b7280;">
      — Team Noctivus '26 &bull; Department of CSE (Cyber Security)
    </div>
  </div>
</body>
</html>"""


async def send_smtp_email(
    to_email: str,
    subject: str,
    html_body: str,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
    inline_image_bytes: bytes | None = None,
    inline_image_cid: str | None = None,
    inline_image_name: str | None = None,
) -> None:
    sender_name = "Noctivus '26"
    sender_email = settings.smtp_from_email or "noctivus2026@gmail.com"
    from_header = formataddr((sender_name, sender_email))

    if inline_image_bytes and inline_image_cid:
        # Build multipart/related so the image is embedded inline — no attachment paperclip
        outer = MIMEMultipart("mixed")
        outer["From"] = from_header
        outer["To"] = to_email
        outer["Subject"] = subject

        related = MIMEMultipart("related")
        html_part = MIMEText(html_body, "html", "utf-8")
        related.attach(html_part)

        img_part = MIMEImage(inline_image_bytes, name=inline_image_name or "image.png")
        img_part.add_header("Content-ID", f"<{inline_image_cid}>")
        img_part.add_header("Content-Disposition", "inline", filename=inline_image_name or "image.png")
        related.attach(img_part)

        outer.attach(related)
        message = outer
    else:
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
        print(f"[SMTP Dev Simulation] Email to {to_email} (Subject: {subject}, Inline image: {bool(inline_image_bytes)}) - set SMTP_PASSWORD to send live.")
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

    receipt_bytes = None
    receipt_gen_failed = False
    receipt_error_note = None

    # Generate official Payment Receipt image bytes for inline embedding
    try:
        receipt_bytes = await render_receipt_artwork_bytes(member)
    except Exception as img_err:
        receipt_gen_failed = True
        receipt_error_note = "Receipt image generation failed, email sent without inline image"
        print(f"[Receipt Gen Error for {reg_id}]: {img_err}")

    subject = "Noctivus '26 — Payment Verified & Receipt ✅"
    cid = make_msgid(domain="noctivus.site").strip("<>")
    html_content = build_confirmation_html(full_name, event_names_str, cid=cid if (receipt_bytes and not receipt_gen_failed) else None)
    safe_name = re.sub(r"[^\w\s-]", "", full_name).strip().replace(" ", "_") or "Member"
    inline_name = f"Noctivus26_Receipt_{safe_name}.png"

    try:
        await send_smtp_email(
            to_email=email,
            subject=subject,
            html_body=html_content,
            inline_image_bytes=receipt_bytes if not receipt_gen_failed else None,
            inline_image_cid=cid if not receipt_gen_failed else None,
            inline_image_name=inline_name,
        )

        now = datetime.now(timezone.utc)
        status_updates = {
            "payment_email_status": "sent",
            "payment_email_sent_at": now,
            "payment_email_error": receipt_error_note,
        }
        await update_registration(reg_id, status_updates)
        print(f"[Payment Confirmation Receipt Email] Sent inline to {email} ({reg_id})")
        return {"success": True}
    except Exception as send_err:
        err_msg = str(send_err) or "SMTP delivery failed"
        await update_registration(reg_id, {
            "payment_email_status": "failed",
            "payment_email_error": err_msg,
        })
        print(f"[Payment Confirmation Email Failed for {reg_id}]: {err_msg}")
        return {"success": False, "error": err_msg}


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
        cid = make_msgid(domain="noctivus.site").strip("<>")

        await send_smtp_email(
            to_email=email,
            subject=f"{pass_data['title']}",
            html_body=invitation_html(registration, pass_data, event_names, cid=cid),
            inline_image_bytes=artwork,
            inline_image_cid=cid,
            inline_image_name=f"Noctivus26_Pass_{safe_name}.png",
        )

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

    reg_id = str(registration.get("registrationId") or "preview")
    cid = make_msgid(domain="noctivus.site").strip("<>")

    await send_smtp_email(
        to_email=email,
        subject=f"{pass_data['title']} - {reg_id}",
        html_body=invitation_html(registration, pass_data, event_names, cid=cid),
        inline_image_bytes=artwork,
        inline_image_cid=cid,
        inline_image_name=f"noctivus-boarding-pass-{reg_id}.png",
    )


async def send_confirmation(registration: dict) -> None:
    await sendPaymentConfirmationEmail(registration)


async def send_announcement(registration: dict, data: dict) -> None:
    participant = registration.get("participant") or {}
    email = str(participant.get("email") or "").strip()
    if not email:
        return
    await send_smtp_email(email, subject, f"<h1>{subject}</h1><p>{message}</p>")


def invitation_html(registration: dict, pass_data: dict, event_names: str, artwork: bytes | None = None, cid: str | None = None) -> str:
    participant = registration.get("participant") or {}
    name = html.escape(str(participant.get("name") or "Member"))
    college = html.escape(str(participant.get("college") or "Institution"))
    reg_id = html.escape(str(registration.get("registrationId") or ""))
    event_esc = html.escape(str(event_names or "Noctivus '26 Events"))
    date_esc = html.escape(str(pass_data.get("date") or "26 September 2026"))
    time_esc = html.escape(str(pass_data.get("time") or "09:00 AM"))
    venue_esc = html.escape(str(pass_data.get("venue") or "Velammal Engineering College, Chennai"))
    title_esc = html.escape(str(pass_data.get("title") or "Noctivus '26 Official Event Pass"))

    # Event pass image — prefer CID inline embed, fall back to base64 data URI
    if cid:
        img_tag = f'<img src="cid:{cid}" alt="Your Noctivus \'26 Event Pass" style="display:block;width:100%;max-width:600px;border-radius:12px;margin:0 auto;" />'
    elif artwork:
        b64 = base64.b64encode(artwork).decode("ascii")
        img_tag = f'<img src="data:image/png;base64,{b64}" alt="Your Noctivus \'26 Event Pass" style="display:block;width:100%;max-width:600px;border-radius:12px;margin:0 auto;" />'
    else:
        img_tag = ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title_esc}</title>
</head>
<body style="margin:0;padding:20px;background:#080b12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080b12;padding:16px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:32px;box-shadow:0 12px 36px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding:0 0 20px;border-bottom:1px solid #1e293b;text-align:left;">
              <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#00c8e0;font-weight:700;display:block;margin-bottom:4px;">DEPARTMENT OF CSE (CYBER SECURITY)</span>
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#f8fafc;letter-spacing:-0.02em;">NOCTIVUS &rsquo;26 &bull; OFFICIAL EVENT PASS</h1>
            </td>
          </tr>

          <!-- Welcome Message -->
          <tr>
            <td style="padding:24px 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">
              <p style="margin:0 0 14px;font-size:16px;color:#f8fafc;">Dear <strong>{name}</strong>,</p>
              <p style="margin:0 0 14px;">
                Welcome to <strong>Noctivus &rsquo;26</strong>! We are thrilled to welcome you to the National Level Technical Symposium organized by the Department of Computer Science & Engineering (Cyber Security) at <strong>Velammal Engineering College</strong>, Chennai.
              </p>
              <p style="margin:0 0 14px;">
                Your seat is confirmed for <strong>{event_esc}</strong>. Your official Registration ID is <strong style="color:#00c8e0;font-family:monospace;letter-spacing:0.05em;">{reg_id}</strong>.
              </p>
            </td>
          </tr>

          <!-- Key Information Box -->
          <tr>
            <td style="padding:0 0 24px;">
              <div style="background:rgba(0,200,224,0.06);border:1px solid rgba(0,200,224,0.2);border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#67e8f9;text-transform:uppercase;letter-spacing:1px;">Symposium Details & Reporting Time</p>
                <table role="presentation" width="100%" style="font-size:13px;color:#cbd5e1;line-height:1.6;">
                  <tr><td style="width:110px;color:#94a3b8;padding:3px 0;">📅 Date:</td><td><strong>{date_esc}</strong></td></tr>
                  <tr><td style="color:#94a3b8;padding:3px 0;">⏰ Reporting:</td><td><strong>08:30 AM</strong> (Inauguration at 09:00 AM)</td></tr>
                  <tr><td style="color:#94a3b8;padding:3px 0;">📍 Venue:</td><td>{venue_esc}</td></tr>
                  <tr><td style="color:#94a3b8;padding:3px 0;">🎯 Events:</td><td><strong>{event_esc}</strong></td></tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Pass Section Header -->
          <tr>
            <td style="padding:0 0 12px;text-align:left;">
              <span style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">YOUR SYMPOSIUM ENTRY PASS</span>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Present the QR code on your pass below at the registration desk / entry gate for fast check-in.</p>
            </td>
          </tr>

          <!-- Event Pass Artwork (Placed at bottom) -->
          <tr>
            <td style="padding:0 0 24px;">
              <div style="border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,200,224,0.2);border:1px solid #334155;">
                {img_tag}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #1e293b;padding-top:20px;text-align:left;font-size:13px;color:#64748b;line-height:1.5;">
              <p style="margin:0 0 4px;color:#94a3b8;font-weight:600;">We look forward to an electrifying symposium experience!</p>
              <p style="margin:0;">&mdash; Team Noctivus &rsquo;26 &bull; Department of CSE (Cyber Security), Velammal Engineering College</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_pass_artwork(registration: dict, pass_data: dict) -> str:
    raise RuntimeError("Use render_pass_artwork_bytes asynchronously for generated boarding passes.")
