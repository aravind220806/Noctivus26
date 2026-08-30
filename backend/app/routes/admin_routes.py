from datetime import datetime, timezone
import hashlib
import json
import logging
import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.rate_limit import limiter
from app.middleware.admin_auth import require_admin, require_admin_tab, require_any_admin_tab, sign_admin_token
from app.services.admin_access_service import ADMIN_TABS, deactivate_admin_access, is_owner_admin, list_admin_access, normalize_admin_tabs, resolve_admin_access, upsert_admin_access
from app.services.analysis_service import build_overview, create_ai_analysis
from app.services.event_service import list_events
from app.services.boarding_pass_service import create_pass_token, render_pass_artwork_bytes
from app.services.email_service import normalize_pass_template, queue_email, send_confirmation, send_invitation, send_member_pass, sendPaymentConfirmationEmail
from app.services.export_service import export_scheduler_to_excel, registrations_to_csv
from app.services.event_service import admin_events, update_event, get_event
from app.services.audit_service import list_admin_actions, record_admin_action
from app.services.google_auth_service import verify_google_credential
from app.services.registration_service import create_registration_id, load_registrations, serialize_registration, update_registration
from app.services.scheduler_service import assignMembersToSlots, create_custom_slot, delete_slot, generate_all_event_slots, get_scheduler_dashboard_data, load_all_slots, slotsConflict, update_slot
from app.db.memory_store import memory_registrations
from app.db import mongo

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/auth/google")
@limiter.limit("10/minute")
async def google_auth(request: Request):
    try:
        body = await request.json()
        credential = str(body.get("credential") or "")
        if not credential:
            raise HTTPException(status_code=400, detail="Google credential is required.")
        if not settings.google_client_id:
            raise HTTPException(status_code=503, detail="Google OAuth is not configured on the server.")
        profile = await verify_google_credential(credential)
        if not profile.get("email") or not profile.get("email_verified"):
            raise HTTPException(status_code=401, detail="Use a verified Google account.")
        google_email = str(profile["email"]).strip().lower()
        access = await resolve_admin_access(google_email)
        if not access:
            raise HTTPException(status_code=403, detail="This Google account is not allowed for admin access. Add the exact Google email to ADMIN_EMAILS or Admin Access.")
        user = {"email": google_email, "name": profile.get("name") or google_email, "picture": profile.get("picture") or "", "tabs": access["tabs"], "owner": access["owner"]}
        origin = str(request.headers.get("origin") or "")
        is_https = origin.startswith("https://") or request.headers.get("x-forwarded-proto") == "https" or settings.environment == "production"
        token, csrf = sign_admin_token(user)
        response = Response(
            content=json.dumps({"user": user, "csrfToken": csrf}, separators=(",", ":")),
            media_type="application/json",
        )
        response.set_cookie(
            "noctivus_admin_session",
            token,
            max_age=8 * 60 * 60,
            httponly=True,
            secure=is_https,
            samesite="lax",
            path="/",
        )
        return response
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Google admin authentication failed")
        raise HTTPException(status_code=502, detail="The server could not complete Google admin authentication. Check the backend logs.") from error


@router.post("/auth/dev")
async def dev_auth():
    if settings.environment == "production":
        raise HTTPException(status_code=403, detail="Dev login is disabled in production.")
    owner_email = settings.admin_emails[0] if settings.admin_emails else "admin@noctivus.site"
    access = await resolve_admin_access(owner_email)
    user = {
        "email": owner_email,
        "name": "Admin (Dev)",
        "picture": "",
        "tabs": access["tabs"] if access else ADMIN_TABS,
        "owner": True,
    }
    token, csrf = sign_admin_token(user)
    response = Response(content=json.dumps({"user": user, "csrfToken": csrf}, separators=(",", ":")), media_type="application/json")
    response.set_cookie(
        "noctivus_admin_session",
        token,
        max_age=8 * 60 * 60,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/api/admin",
    )
    return response


@router.get("/me")
async def me(admin=Depends(require_admin)):
    return {"user": admin, "tabs": admin["tabs"]}


@router.post("/logout")
async def logout():
    response = Response(content='{"ok":true}', media_type="application/json")
    cookie_options = {
        "secure": settings.environment == "production",
        "httponly": True,
        "samesite": "lax",
    }
    response.delete_cookie("noctivus_admin_session", path="/api/admin", **cookie_options)
    response.delete_cookie("noctivus_admin_session", path="/", **cookie_options)
    return response


@router.get("/events")
async def events(_admin=Depends(require_any_admin_tab(["Events", "Invitations"]))):
    return {"events": await admin_events()}


@router.get("/scheduler")
async def scheduler_get(_admin=Depends(require_admin_tab("Event Scheduler"))):
    return await get_scheduler_dashboard_data()


@router.post("/scheduler/generate-slots")
async def scheduler_generate_slots(request: Request, admin=Depends(require_admin_tab("Event Scheduler"))):
    try:
        body = await request.json()
    except Exception:
        body = {}
    regenerate = bool(body.get("regenerate", False))
    result = await generate_all_event_slots(regenerate=regenerate)
    await record_admin_action(
        admin["email"],
        "scheduler.generate_slots",
        "all_events",
        {"regenerate": regenerate, "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    return result


@router.post("/scheduler/run-assignment")
async def scheduler_run_assignment(admin=Depends(require_admin_tab("Event Scheduler"))):
    try:
        summary = await assignMembersToSlots()
        await record_admin_action(
            admin["email"],
            "scheduler.run_assignment",
            "all_registrations",
            {"summary": summary, "timestamp": datetime.now(timezone.utc).isoformat()},
        )
        return summary
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Assignment execution failed: {err}")


@router.post("/scheduler/slots")
async def scheduler_create_slot(request: Request, admin=Depends(require_admin_tab("Event Scheduler"))):
    body = await request.json()
    new_slot = await create_custom_slot(body)
    await record_admin_action(
        admin["email"],
        "scheduler.create_slot",
        new_slot["id"],
        {"slot": new_slot, "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    return {"slot": new_slot, "success": True}


@router.patch("/scheduler/slots/{slot_id}")
async def scheduler_update_slot(slot_id: str, request: Request, admin=Depends(require_admin_tab("Event Scheduler"))):
    body = await request.json()
    updated = await update_slot(slot_id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Slot not found.")
    await record_admin_action(
        admin["email"],
        "scheduler.update_slot",
        slot_id,
        {"updates": body, "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    return {"slot": updated, "success": True}


@router.delete("/scheduler/slots/{slot_id}")
async def scheduler_delete_slot(slot_id: str, admin=Depends(require_admin_tab("Event Scheduler"))):
    deleted = await delete_slot(slot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Slot not found.")
    await record_admin_action(
        admin["email"],
        "scheduler.delete_slot",
        slot_id,
        {"timestamp": datetime.now(timezone.utc).isoformat()},
    )
    return {"success": True}


@router.get("/scheduler/export")
async def scheduler_export_excel(admin=Depends(require_admin_tab("Event Scheduler"))):
    events = await list_events()
    slots = await load_all_slots()
    registrations = await load_registrations()
    excel_bytes = export_scheduler_to_excel(events, slots, registrations)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"Noctivus26_Event_Schedule_{timestamp}.xlsx"
    await record_admin_action(
        admin["email"],
        "scheduler.export_excel",
        "all_slots",
        {"timestamp": datetime.now(timezone.utc).isoformat()},
    )
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/events/{event_id}")
async def patch_event(event_id: str, request: Request, admin=Depends(require_admin_tab("Events"))):
    changes = await request.json()
    try:
        event = await update_event(event_id, changes, admin["email"])
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    await record_admin_action(admin["email"], "event.update", event_id, changes)
    return {"event": event}


@router.get("/audit-log")
async def audit_log(search: str = "", _admin=Depends(require_admin_tab("Audit Log"))):
    return {"actions": await list_admin_actions(search)}


@router.post("/check-in/{registration_id}")
@limiter.limit("120/minute")
async def check_in(request: Request, registration_id: str, admin=Depends(require_admin_tab("Check-in"))):
    scanned_id = registration_id
    parsed = urlparse(registration_id)
    if parsed.path:
        candidate = parsed.path.rstrip("/").split("/")[-1]
        if candidate and candidate != registration_id:
            scanned_id = candidate
    token_hash = hashlib.sha256(scanned_id.encode("utf-8")).hexdigest()
    current = None
    if mongo.mongo_ready():
        current = await mongo.db.registrations.find_one({
            "$or": [
                {"registrationId": {"$regex": f"^{re.escape(scanned_id)}$", "$options": "i"}},
                {"invitation.qrHash": token_hash},
                {"invitation.qrHash": scanned_id},
                {"invitation.qrToken": scanned_id},
                {"qrHash": token_hash},
                {"qrToken": scanned_id},
            ]
        })
    else:
        clean_lower = scanned_id.lower()
        current = next(
            (
                item
                for item in memory_registrations
                if str(item.get("registrationId") or "").lower() == clean_lower
                or str((item.get("invitation") or {}).get("qrHash") or item.get("qrHash") or "") in [token_hash, scanned_id]
                or str((item.get("invitation") or {}).get("qrToken") or item.get("qrToken") or "") == scanned_id
            ),
            None,
        )
    if not current:
        raise HTTPException(status_code=404, detail="Registration not found. Send participant to the help desk.")
    if current.get("paymentStatus") != "confirmed":
        raise HTTPException(status_code=409, detail="Payment is not confirmed. Send participant to the help desk.")
    if current.get("checkedIn"):
        return {"status": "already-checked-in", "checkedInAt": current.get("checkedInAt"), "registration": serialize_registration(current)}
    checked_at = datetime.now(timezone.utc)
    if mongo.mongo_ready():
        checked = await mongo.db.registrations.find_one_and_update(
            {"registrationId": current["registrationId"], "paymentStatus": "confirmed", "checkedIn": {"$ne": True}},
            {"$set": {"checkedIn": True, "checkedInAt": checked_at, "checkedInBy": admin["email"], "updatedAt": checked_at}},
            return_document=ReturnDocument.AFTER,
        )
    else:
        checked = await update_registration(current["registrationId"], {"checkedIn": True, "checkedInAt": checked_at, "checkedInBy": admin["email"]})
    if not checked:
        return {"status": "already-checked-in", "checkedInAt": current.get("checkedInAt"), "registration": serialize_registration(current)}
    await record_admin_action(admin["email"], "check-in", current["registrationId"])
    return {"status": "checked-in", "registration": serialize_registration(checked)}


@router.get("/check-in/summary")
async def check_in_summary(_admin=Depends(require_admin_tab("Check-in"))):
    if mongo.mongo_ready():
        confirmed = await mongo.db.registrations.count_documents({"paymentStatus": "confirmed"})
        checked_in = await mongo.db.registrations.count_documents({"paymentStatus": "confirmed", "checkedIn": True})
        return {"confirmed": confirmed, "checkedIn": checked_in}
    rows = await load_registrations()
    return {"confirmed": sum(row.get("paymentStatus") == "confirmed" for row in rows), "checkedIn": sum(row.get("checkedIn") is True for row in rows)}


@router.post("/walk-ins")
@limiter.limit("30/minute")
async def create_walk_in(request: Request, admin=Depends(require_admin_tab("Check-in"))):
    body = await request.json()
    participant = body.get("participant") or {}
    name = str(participant.get("name") or "").strip()[:80]
    college = str(participant.get("college") or "").strip()[:120]
    event_id = str(body.get("eventId") or "")[:80]
    event = await get_event(event_id)
    if len(name) < 2 or len(college) < 2 or not event:
        raise HTTPException(status_code=400, detail="Name, college, and a valid event are required.")
    record = {"registrationId": create_registration_id(), "participant": {"name": name, "college": college, "email": str(participant.get("email") or "")[:190], "phone": re.sub(r"\D", "", str(participant.get("phone") or ""))[:10], "foodPreference": ""}, "eventRegistrations": [{"eventId": event["id"], "eventName": event["name"], "category": event["category"], "feeSnapshot": event["fee"], "teamSize": 1, "teamSizeMin": 1, "teamSizeMax": 1, "teamMembers": []}], "paymentStatus": "confirmed", "claimedAmount": 0, "expectedAmount": 0, "isWalkIn": True, "checkedIn": True, "checkedInAt": datetime.now(timezone.utc), "checkedInBy": admin["email"], "createdAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}
    if mongo.mongo_ready():
        await mongo.db.registrations.insert_one(record)
    else:
        memory_registrations.append(record)
    await record_admin_action(admin["email"], "walk-in.create", record["registrationId"], {"eventId": event_id})
    return {"registration": serialize_registration(record)}


@router.get("/access")
async def access(_admin=Depends(require_admin_tab("Admin Access"))):
    return {"users": await list_admin_access(), "tabs": [tab for tab in ADMIN_TABS if tab != "Admin Access"]}


@router.put("/access/{email}")
async def put_access(email: str, request: Request, admin=Depends(require_admin_tab("Admin Access"))):
    normalized_email = email.strip().lower()
    if not re.match(r"^\S+@\S+\.\S+$", normalized_email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if is_owner_admin(normalized_email):
        raise HTTPException(status_code=400, detail="Owner access is controlled from ADMIN_EMAILS.")
    body = await request.json()
    tabs = normalize_admin_tabs(body.get("tabs"))
    if not tabs:
        raise HTTPException(status_code=400, detail="Select at least one tab.")
    user = await upsert_admin_access(normalized_email, body.get("name"), tabs, body.get("active") is not False, admin["email"])
    return {"user": user}


@router.delete("/access/{email}")
async def delete_access(email: str, admin=Depends(require_admin_tab("Admin Access"))):
    normalized_email = email.strip().lower()
    if is_owner_admin(normalized_email):
        raise HTTPException(status_code=400, detail="Owner access is controlled from ADMIN_EMAILS.")
    await deactivate_admin_access(normalized_email, admin["email"])
    return {"ok": True}


@router.get("/overview")
async def overview(_admin=Depends(require_any_admin_tab(["Dashboard", "Verify Members", "Invitations", "AI Analysis", "Export"]))):
    result = build_overview(await load_registrations(), await list_events())
    result["storage"] = await mongo.storage_usage()
    return result


@router.get("/registrations")
async def registrations(eventId: str | None = None, status: str | None = None, search: str | None = None, _admin=Depends(require_any_admin_tab(["Verify Members", "Invitations", "Export"]))):
    rows = await load_registrations({"eventId": eventId, "status": status, "search": search})
    all_rows = await load_registrations()
    values = {"utr": {}, "email": {}, "phone": {}}
    for row in all_rows:
        participant = row.get("participant") or {}
        for key, value in [("utr", row.get("normalizedUtr")), ("email", (participant.get("email") or "").lower()), ("phone", participant.get("phone"))]:
            if value:
                values[key][value] = values[key].get(value, 0) + 1
    output = []
    for row in rows:
        participant = row.get("participant") or {}
        flags = [key for key, value in [("utr", row.get("normalizedUtr")), ("email", (participant.get("email") or "").lower()), ("phone", participant.get("phone"))] if value and values[key].get(value, 0) > 1]
        item = serialize_registration(row)
        item["duplicateFlags"] = flags
        output.append(item)
    return {"registrations": output}


@router.post("/registrations/bulk-verify")
@limiter.limit("10/minute")
async def bulk_verify(request: Request, admin=Depends(require_admin_tab("Verify Members"))):
    body = await request.json()
    ids = [str(value) for value in body.get("registrationIds", [])][:200]
    status = body.get("status")
    if status not in ["confirmed", "mismatch", "duplicate"] or not ids:
        raise HTTPException(status_code=400, detail="Select registrations and a valid status.")
    changed = 0
    for registration_id in ids:
        reg = await update_registration(registration_id, {"paymentStatus": status, "verifiedAt": datetime.now(timezone.utc), "verifiedBy": admin["email"]})
        if reg:
            changed += 1
            if status == "confirmed":
                asyncio.create_task(sendPaymentConfirmationEmail(reg))
    await record_admin_action(admin["email"], f"registration.bulk.{status}", "bulk", {"count": changed})
    return {"updated": changed}


@router.patch("/registrations/{registration_id}/verify")
@limiter.limit("30/minute")
async def verify_registration(registration_id: str, request: Request, admin=Depends(require_admin_tab("Verify Members"))):
    body = await request.json()
    if body.get("status") not in ["confirmed", "mismatch", "duplicate"]:
        raise HTTPException(status_code=400, detail="Invalid registration status.")
    update = {"paymentStatus": body["status"], "verifiedAt": datetime.now(timezone.utc), "verifiedBy": admin["email"], "verificationNotes": str(body.get("notes") or "")[:500]}
    registration = await update_registration(registration_id, update)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found.")

    if update["paymentStatus"] == "confirmed" and body.get("sendEmail") is not False:
        try:
            await sendPaymentConfirmationEmail(registration)
        except Exception as err:
            logger.error(f"Error sending payment confirmation email: {err}")

    rows = await load_registrations()
    fresh_reg = next((r for r in rows if r.get("registrationId") == registration_id), registration)
    await record_admin_action(admin["email"], f"registration.{update['paymentStatus']}", registration_id, {"notes": update["verificationNotes"]})
    return {"registration": serialize_registration(fresh_reg)}


@router.post("/registrations/{registration_id}/resend-confirmation-email")
@limiter.limit("20/minute")
async def resend_confirmation_email(registration_id: str, request: Request, admin=Depends(require_admin_tab("Verify Members"))):
    rows = await load_registrations()
    registration = next((r for r in rows if r.get("registrationId") == registration_id), None)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found.")
    result = await sendPaymentConfirmationEmail(registration)
    fresh_rows = await load_registrations()
    fresh_reg = next((r for r in fresh_rows if r.get("registrationId") == registration_id), registration)
    await record_admin_action(admin["email"], "registration.resend_confirmation_email", registration_id, result)
    return {"success": result.get("success", False), "result": result, "registration": serialize_registration(fresh_reg)}


@router.get("/invitations/stats")
async def invitations_stats(_admin=Depends(require_admin_tab("Invitations"))):
    rows = await load_registrations({"status": "confirmed"})
    total_eligible = len(rows)
    sent_count = sum(1 for r in rows if r.get("pass_status") == "sent")
    failed_count = sum(1 for r in rows if r.get("pass_status") == "failed")
    unsent_count = sum(1 for r in rows if (r.get("pass_status") or "not_sent") != "sent")
    return {
        "totalEligible": total_eligible,
        "sentCount": sent_count,
        "failedCount": failed_count,
        "unsentCount": unsent_count,
    }


@router.post("/invitations/send-batch")
@limiter.limit("5/minute")
async def invitations_send_batch(request: Request, admin=Depends(require_admin_tab("Invitations"))):
    body = await request.json()
    try:
        batch_size = int(body.get("batchSize") or 0)
    except (ValueError, TypeError):
        batch_size = 0
    if batch_size <= 0:
        raise HTTPException(status_code=400, detail="Please enter a valid batch size of 1 or more.")

    all_confirmed = await load_registrations({"status": "confirmed", "sortAsc": True})
    eligible = [r for r in all_confirmed if (r.get("pass_status") or "not_sent") != "sent"]
    batch = eligible[:batch_size]

    successful = []
    failed_list = []

    for registration in batch:
        result = await send_member_pass(registration, admin["email"])
        if result["success"]:
            successful.append({
                "registrationId": result["registrationId"],
                "name": result["name"],
                "email": result["email"],
            })
        else:
            failed_list.append({
                "registrationId": result["registrationId"],
                "name": result["name"],
                "email": result["email"],
                "reason": result.get("reason") or "Send failed",
            })

    await record_admin_action(
        admin["email"],
        "invitation.batch_send",
        f"batch_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        {"attempted": len(batch), "succeeded": len(successful), "failed": len(failed_list)},
    )

    return {
        "attempted": len(batch),
        "succeeded": len(successful),
        "failed": len(failed_list),
        "successful": successful,
        "failedList": failed_list,
    }


@router.post("/invitations/resend-failed")
@limiter.limit("5/minute")
async def invitations_resend_failed(request: Request, admin=Depends(require_admin_tab("Invitations"))):
    body = await request.json()
    reg_ids = [str(x).strip() for x in (body.get("registrationIds") or []) if str(x).strip()]
    if not reg_ids:
        raise HTTPException(status_code=400, detail="No failed registration IDs provided for resend.")

    all_confirmed = await load_registrations({"status": "confirmed"})
    targets = [r for r in all_confirmed if r.get("registrationId") in reg_ids]

    successful = []
    failed_list = []

    for registration in targets:
        result = await send_member_pass(registration, admin["email"])
        if result["success"]:
            successful.append({
                "registrationId": result["registrationId"],
                "name": result["name"],
                "email": result["email"],
            })
        else:
            failed_list.append({
                "registrationId": result["registrationId"],
                "name": result["name"],
                "email": result["email"],
                "reason": result.get("reason") or "Resend failed",
            })

    await record_admin_action(
        admin["email"],
        "invitation.resend_failed",
        f"resend_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        {"attempted": len(targets), "succeeded": len(successful), "failed": len(failed_list)},
    )

    return {
        "attempted": len(targets),
        "succeeded": len(successful),
        "failed": len(failed_list),
        "successful": successful,
        "failedList": failed_list,
    }


@router.post("/invitations/preview")
async def invitations_preview(request: Request, _admin=Depends(require_admin_tab("Invitations"))):
    body = await request.json()
    registration_id = str(body.get("registrationId") or "").strip()

    rows = await load_registrations({"status": "confirmed"})
    registration = next((row for row in rows if row.get("registrationId") == registration_id), None) if registration_id else (rows[0] if rows else None)

    if not registration:
        registration = {
            "registrationId": "NOC26-PREVIEW",
            "participant": {
                "name": "Alex Johnson",
                "college": "St. Joseph's Institute of Technology",
                "email": "alex.johnson@example.com",
                "foodPreference": "Vegetarian",
            },
            "eventRegistrations": [{
                "eventId": "ideathon",
                "eventName": "Ideathon Challenge",
                "category": "Technical",
                "feeSnapshot": 200,
                "venue": "Main Auditorium",
                "date": "26 SEP 2026",
                "time": "09:00 AM",
            }],
            "expectedAmount": 200,
        }

    events = registration.get("eventRegistrations") or []
    event_entry = events[0] if events else {}
    event_id = str(event_entry.get("eventId") or "")
    event_rec = (await get_event(event_id)) if event_id else None
    event_rec = event_rec or {}

    pass_data = {
        "title": f"Noctivus '26 Boarding Pass",
        "eventId": event_id,
        "eventName": str(event_entry.get("eventName") or event_rec.get("name") or "Noctivus '26"),
        "venue": str(event_rec.get("venue") or event_entry.get("venue") or "Velammal Engineering College"),
        "date": str(event_rec.get("date") or event_entry.get("date") or "26 SEP 2026"),
        "time": str(event_entry.get("batchTime") or event_rec.get("time") or event_entry.get("time") or "09:00 AM"),
        "gate": str(event_rec.get("gate") or "VEC Gate 1"),
        "terminal": str(event_rec.get("terminal") or "Main Hall"),
        "seatType": str(event_rec.get("seatType") or "VIP"),
        "slotTiming": str(event_entry.get("slotTiming") or (f"{event_rec.get('time', '09:00 AM')} - 01:00 PM" if "AM" in str(event_rec.get("time", "")) else "02:00 PM - 05:00 PM")),
        "seatNumber": f"S-{str(registration.get('registrationId', '001'))[-4:]}",
    }

    preview_token = create_pass_token()[0]
    return Response(content=await render_pass_artwork_bytes(registration, pass_data, preview_token), media_type="image/png")


@router.post("/announcements/send")
@limiter.limit("10/minute")
async def announcements_send(request: Request, admin=Depends(require_admin_tab("Announcements"))):
    body = await request.json()
    subject = str(body.get("subject") or "").strip()[:160]
    message = str(body.get("message") or "").strip()[:5000]
    channel = body.get("channel") or "email"
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required.")
    if channel == "sms":
        raise HTTPException(status_code=503, detail="SMS delivery is not configured. Add an SMS provider before sending.")
    audience = body.get("audience") or "confirmed"
    rows = await load_registrations({"status": "confirmed"})
    if audience.startswith("event:"):
        rows = [row for row in rows if any(item.get("eventId") == audience.split(":", 1)[1] for item in row.get("eventRegistrations", []))]
    if audience == "checked-in":
        rows = [row for row in rows if row.get("checkedIn") is True]
    for row in rows:
        await queue_email("announcement", row, {"subject": subject, "message": message})
    await record_admin_action(admin["email"], "announcement.send", audience, {"count": len(rows), "channel": channel})
    return {"queued": len(rows), "channel": "email"}


@router.get("/export")
async def export(eventId: str | None = None, status: str | None = None, variant: str = "full", _admin=Depends(require_admin_tab("Export"))):
    admin = _admin
    sponsor_safe = variant == "sponsor"
    csv = registrations_to_csv(await load_registrations({"eventId": eventId, "status": status}), sponsor_safe=sponsor_safe)
    await record_admin_action(admin["email"], "export.csv", eventId or "all", {"status": status or "all", "variant": variant})
    filename_event = re.sub(r"[^a-zA-Z0-9_-]", "-", eventId or "all")[:80]
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="noctivus-{filename_event}-registrations.csv"'})


@router.post("/analysis/ai")
async def analysis(_request: Request, _admin=Depends(require_admin_tab("AI Analysis"))):
    overview = build_overview(await load_registrations(), await list_events())
    return {"analysis": await create_ai_analysis(overview), "generatedAt": datetime.now(timezone.utc).isoformat(), "mode": "offline"}
