import asyncio
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
from app.services.export_service import export_attendance_to_excel, export_scheduler_to_excel, registrations_to_csv
from app.services.event_service import admin_events, update_event, get_event
from app.services.audit_service import list_admin_actions, record_admin_action
from app.services.google_auth_service import verify_google_credential
from app.services.registration_service import create_registration_id, load_registrations, serialize_registration, update_registration
from app.services.scheduler_service import assignMembersToSlots, create_custom_slot, delete_slot, generate_all_event_slots, get_scheduler_dashboard_data, load_all_slots, slotsConflict, update_slot
from app.db.memory_store import memory_registrations
from app.db.sqlite_db import sqlite_db
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
        await record_admin_action(google_email, "auth.login", "admin_portal", {"method": "google_oauth"})
        return response
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Google admin authentication failed")
        raise HTTPException(status_code=502, detail="The server could not complete Google admin authentication. Check the backend logs.") from error


@limiter.limit("5/minute")
@router.post("/auth/dev")
async def dev_auth(request: Request):
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
                path="/",
            )
    await record_admin_action(owner_email, "auth.dev_login", "admin_portal", {"method": "dev"})
    return response


@router.get("/me")
async def me(admin=Depends(require_admin)):
    return {"user": admin, "tabs": admin["tabs"], "csrfToken": admin.get("csrf", "")}


@router.post("/logout")
async def logout(admin=Depends(require_admin)):
    response = Response(content='{"ok":true}', media_type="application/json")
    cookie_options = {
        "secure": settings.environment == "production",
        "httponly": True,
        "samesite": "lax",
    }
    response.delete_cookie("noctivus_admin_session", path="/api/admin", **cookie_options)
    response.delete_cookie("noctivus_admin_session", path="/", **cookie_options)
    if admin and admin.get("email"):
        await record_admin_action(admin["email"], "auth.logout", "admin_portal")
    return response


@limiter.limit("10/minute")
@router.get("/events")
async def events(request: Request, _admin=Depends(require_any_admin_tab(["Events", "Invitations"]))):
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
    await record_admin_action(
        admin["email"],
        "check-in",
        current["registrationId"],
        {
            "name": (current.get("participant") or {}).get("name", ""),
            "college": (current.get("participant") or {}).get("college", ""),
            "events": ", ".join(e.get("eventName") or e.get("eventId") for e in current.get("eventRegistrations", [])),
        },
    )
    return {"status": "checked-in", "registration": serialize_registration(checked)}


@router.get("/check-in/summary")
async def check_in_summary(_admin=Depends(require_admin_tab("Check-in"))):
    if mongo.mongo_ready():
        total_members = await mongo.db.registrations.count_documents({})
        confirmed = await mongo.db.registrations.count_documents({"paymentStatus": "confirmed"})
        checked_in = await mongo.db.registrations.count_documents({"paymentStatus": "confirmed", "checkedIn": True})
        walk_ins = await mongo.db.registrations.count_documents({"isWalkIn": True})
        recent_cursor = mongo.db.registrations.find({"checkedIn": True}).sort("checkedInAt", -1).limit(15)
        recent_docs = await recent_cursor.to_list(length=15)
        return {
            "totalMembers": total_members,
            "confirmed": confirmed,
            "checkedIn": checked_in,
            "walkIns": walk_ins,
            "pendingCheckIn": max(0, confirmed - checked_in),
            "recentCheckIns": [serialize_registration(d) for d in recent_docs],
        }
    rows = await load_registrations()
    total_members = len(rows)
    confirmed = sum(row.get("paymentStatus") == "confirmed" for row in rows)
    checked_in = sum(row.get("checkedIn") is True for row in rows)
    walk_ins = sum(row.get("isWalkIn") is True for row in rows)
    checked_in_rows = [r for r in rows if r.get("checkedIn") is True]
    checked_in_rows.sort(key=lambda x: str(x.get("checkedInAt") or ""), reverse=True)
    return {
        "totalMembers": total_members,
        "confirmed": confirmed,
        "checkedIn": checked_in,
        "walkIns": walk_ins,
        "pendingCheckIn": max(0, confirmed - checked_in),
        "recentCheckIns": [serialize_registration(r) for r in checked_in_rows[:15]],
    }


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
    await record_admin_action(
        admin["email"],
        "walk-in.create",
        record["registrationId"],
        {"name": name, "college": college, "eventId": event_id, "eventName": event["name"]},
    )
    return {"registration": serialize_registration(record)}


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE MANAGEMENT & BOARDING PASS EVENT-WISE CHECK-IN
# ══════════════════════════════════════════════════════════════════════════════

async def find_registration_flexible(query_str: str) -> dict | None:
    raw = str(query_str or "").strip()
    if not raw:
        return None
    scanned = raw
    parsed = urlparse(raw)
    if parsed.path:
        candidate = parsed.path.rstrip("/").split("/")[-1]
        if candidate and candidate != raw:
            scanned = candidate
    token_hash = hashlib.sha256(scanned.encode("utf-8")).hexdigest()

    if mongo.mongo_ready():
        match = await mongo.db.registrations.find_one({
            "$or": [
                {"registrationId": {"$regex": f"^{re.escape(scanned)}$", "$options": "i"}},
                {"invitation.qrHash": token_hash},
                {"invitation.qrHash": scanned},
                {"invitation.qrToken": scanned},
                {"qrHash": token_hash},
                {"qrToken": scanned},
                {"normalized.email": scanned.lower()},
                {"participant.email": {"$regex": f"^{re.escape(scanned)}$", "$options": "i"}},
                {"participant.phone": scanned},
                {"normalizedUtr": scanned},
            ]
        })
        if match:
            return match

    all_regs = await load_registrations()
    clean_lower = scanned.lower()
    for item in all_regs:
        reg_id = str(item.get("registrationId") or "").lower()
        if reg_id == clean_lower or clean_lower in reg_id:
            return item
        qr_hash = str((item.get("invitation") or {}).get("qrHash") or item.get("qrHash") or "")
        qr_token = str((item.get("invitation") or {}).get("qrToken") or item.get("qrToken") or "")
        if qr_hash in (token_hash, scanned) or qr_token == scanned:
            return item
        p = item.get("participant") or {}
        if str(p.get("email") or "").lower() == clean_lower:
            return item
        if str(p.get("phone") or "") == scanned:
            return item
        if str(item.get("normalizedUtr") or "") == scanned:
            return item
        if clean_lower in str(p.get("name") or "").lower():
            return item

    return None


def extract_event_members_with_attendance(reg: dict, event_id: str) -> list[dict]:
    p = reg.get("participant") or {}
    event_regs = reg.get("eventRegistrations") or []
    ev_item = next((e for e in event_regs if e.get("eventId") == event_id), None)
    if not ev_item:
        return []

    att_data = ev_item.get("attendance") or (reg.get("attendance") or {}).get(event_id) or {}
    members_att = {
        (m.get("name") or "").strip().upper(): bool(m.get("present", False))
        for m in att_data.get("members", [])
        if isinstance(m, dict)
    }

    leader_name = (p.get("name") or "").strip().upper()
    leader_present = members_att.get(leader_name, bool(att_data.get("present", False)) if "members" not in att_data else False)

    members_list = [{
        "name": leader_name,
        "rollNo": p.get("rollNo") or p.get("collegeId") or "",
        "role": "Team Leader",
        "isLeader": True,
        "present": leader_present,
    }]

    for tm in ev_item.get("teamMembers") or []:
        if not isinstance(tm, dict):
            continue
        tm_name = (tm.get("name") or "").strip().upper()
        if not tm_name:
            continue
        tm_present = members_att.get(tm_name, False)
        members_list.append({
            "name": tm_name,
            "rollNo": tm.get("rollNo", ""),
            "role": "Team Member",
            "isLeader": False,
            "present": tm_present,
        })

    return members_list


def format_registration_for_attendance(reg: dict, selected_event_id: str | None = None) -> dict:
    base = serialize_registration(reg)
    event_regs = reg.get("eventRegistrations") or []
    events_attendance_info = []

    for ev in event_regs:
        eid = ev.get("eventId")
        if not eid:
            continue
        members = extract_event_members_with_attendance(reg, eid)
        att_data = ev.get("attendance") or (reg.get("attendance") or {}).get(eid) or {}
        present_count = sum(1 for m in members if m.get("present"))
        total_count = len(members)

        events_attendance_info.append({
            "eventId": eid,
            "eventName": ev.get("eventName", eid),
            "category": ev.get("category", "tech"),
            "teamSize": ev.get("teamSize", len(members)),
            "members": members,
            "attended": bool(att_data.get("attended") or present_count > 0),
            "markedAt": att_data.get("markedAt"),
            "markedBy": att_data.get("markedBy"),
            "presentCount": present_count,
            "totalCount": total_count,
            "allPresent": present_count == total_count and total_count > 0,
            "isPartial": 0 < present_count < total_count,
            "isAbsent": present_count == 0,
        })

    base["eventAttendanceList"] = events_attendance_info
    return base


@router.get("/attendance/summary")
async def get_attendance_summary(_admin=Depends(require_admin_tab("Attendance"))):
    configured_events = await list_events()
    all_regs = await load_registrations()
    confirmed_regs = [r for r in all_regs if r.get("paymentStatus") == "confirmed"]

    total_members_overall = 0
    present_members_overall = 0
    event_stats = []

    for ev in configured_events:
        eid = ev.get("id")
        ename = ev.get("name", eid)
        ecat = ev.get("category", "tech")
        evenue = ev.get("venue", "Campus")

        ev_regs = [
            r for r in confirmed_regs
            if any(e.get("eventId") == eid for e in r.get("eventRegistrations", []))
        ]

        total_teams = len(ev_regs)
        event_all_members = []
        teams_attended = 0

        for r in ev_regs:
            m_list = extract_event_members_with_attendance(r, eid)
            event_all_members.extend(m_list)
            if any(m.get("present") for m in m_list):
                teams_attended += 1

        total_m_count = len(event_all_members)
        present_m_count = sum(1 for m in event_all_members if m.get("present"))
        absent_m_count = max(0, total_m_count - present_m_count)
        rate = round((present_m_count / total_m_count * 100), 1) if total_m_count > 0 else 0.0

        total_members_overall += total_m_count
        present_members_overall += present_m_count

        event_stats.append({
            "eventId": eid,
            "eventName": ename,
            "category": ecat,
            "venue": evenue,
            "date": ev.get("date", "2026-09-26"),
            "time": ev.get("time", "10:00 AM"),
            "totalTeams": total_teams,
            "teamsAttended": teams_attended,
            "totalMembers": total_m_count,
            "presentMembers": present_m_count,
            "absentMembers": absent_m_count,
            "attendanceRate": rate,
        })

    overall_rate = round((present_members_overall / total_members_overall * 100), 1) if total_members_overall > 0 else 0.0

    return {
        "totalEvents": len(configured_events),
        "totalRegistrations": len(confirmed_regs),
        "totalMembers": total_members_overall,
        "totalPresentMembers": present_members_overall,
        "totalAbsentMembers": max(0, total_members_overall - present_members_overall),
        "overallAttendanceRate": overall_rate,
        "events": event_stats,
    }


@router.get("/attendance/list")
async def get_attendance_list(
    eventId: str | None = None,
    search: str | None = None,
    status: str | None = None,
    _admin=Depends(require_admin_tab("Attendance")),
):
    all_regs = await load_registrations()
    confirmed = [r for r in all_regs if r.get("paymentStatus") == "confirmed"]

    if eventId:
        confirmed = [r for r in confirmed if any(e.get("eventId") == eventId for e in r.get("eventRegistrations", []))]

    if search:
        term = search.lower().strip()
        filtered = []
        for r in confirmed:
            p = r.get("participant") or {}
            reg_id = str(r.get("registrationId") or "").lower()
            name = str(p.get("name") or "").lower()
            college = str(p.get("college") or "").lower()
            email = str(p.get("email") or "").lower()
            phone = str(p.get("phone") or "")
            # Check team member names
            ev_regs = r.get("eventRegistrations") or []
            tm_names = " ".join(
                str(tm.get("name") or "").lower()
                for ev in ev_regs
                for tm in ev.get("teamMembers", [])
                if isinstance(tm, dict)
            )
            if term in f"{reg_id} {name} {college} {email} {phone} {tm_names}":
                filtered.append(r)
        confirmed = filtered

    results = []
    for r in confirmed:
        formatted = format_registration_for_attendance(r, eventId)

        # Filter by status if specified
        if status and eventId:
            ev_att = next((item for item in formatted.get("eventAttendanceList", []) if item.get("eventId") == eventId), None)
            if status == "present" and not (ev_att and ev_att.get("allPresent")):
                continue
            if status == "partial" and not (ev_att and ev_att.get("isPartial")):
                continue
            if status == "absent" and not (ev_att and ev_att.get("isAbsent")):
                continue

        results.append(formatted)

    return {"registrations": results, "count": len(results)}


@router.get("/attendance/lookup/{query}")
@limiter.limit("120/minute")
async def lookup_attendance_registration(request: Request, query: str, _admin=Depends(require_admin_tab("Attendance"))):
    reg = await find_registration_flexible(query)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration or Boarding Pass not found. Enter registration ID manually.")

    formatted = format_registration_for_attendance(reg)
    return {"registration": formatted}


@router.post("/attendance/mark")
@limiter.limit("60/minute")
async def mark_event_attendance(request: Request, admin=Depends(require_admin_tab("Attendance"))):
    body = await request.json()
    registration_id = str(body.get("registrationId") or "").strip()
    event_id = str(body.get("eventId") or "").strip()
    members_payload = body.get("members") if isinstance(body.get("members"), list) else []
    notes = str(body.get("notes") or "").strip()[:200]

    if not registration_id or not event_id:
        raise HTTPException(status_code=400, detail="Registration ID and Event ID are required.")

    reg = await find_registration_flexible(registration_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found.")

    event_regs = reg.get("eventRegistrations") or []
    target_ev_index = next((i for i, e in enumerate(event_regs) if e.get("eventId") == event_id), None)
    if target_ev_index is None:
        raise HTTPException(status_code=400, detail=f"Participant is not registered for event '{event_id}'.")

    now_iso = datetime.now(timezone.utc).isoformat()
    present_count = sum(1 for m in members_payload if m.get("present"))
    is_attended = present_count > 0

    attendance_record = {
        "attended": is_attended,
        "markedAt": now_iso,
        "markedBy": admin["email"],
        "notes": notes,
        "members": [
            {
                "name": str(m.get("name") or "").strip().upper(),
                "rollNo": str(m.get("rollNo") or "").strip(),
                "role": m.get("role", "Team Member"),
                "isLeader": bool(m.get("isLeader", False)),
                "present": bool(m.get("present", False)),
            }
            for m in members_payload
            if isinstance(m, dict)
        ],
    }

    # Update eventRegistrations[target_ev_index].attendance
    event_regs[target_ev_index]["attendance"] = attendance_record

    # Update top-level attendance map
    top_attendance = reg.get("attendance") or {}
    top_attendance[event_id] = attendance_record

    update_payload = {
        "eventRegistrations": event_regs,
        "attendance": top_attendance,
        "updatedAt": now_iso,
    }

    if mongo.mongo_ready():
        updated = await mongo.db.registrations.find_one_and_update(
            {"registrationId": reg["registrationId"]},
            {"$set": update_payload},
            return_document=ReturnDocument.AFTER,
        )
    else:
        updated = await update_registration(reg["registrationId"], update_payload)

    await record_admin_action(
        admin["email"],
        "attendance.mark",
        reg["registrationId"],
        {
            "eventId": event_id,
            "presentCount": present_count,
            "totalMembers": len(members_payload),
            "notes": notes,
        },
    )

    formatted = format_registration_for_attendance(updated or reg, event_id)
    return {"message": "Attendance marked successfully.", "registration": formatted}


@router.post("/attendance/quick-toggle")
@limiter.limit("120/minute")
async def quick_toggle_attendance(request: Request, admin=Depends(require_admin_tab("Attendance"))):
    body = await request.json()
    registration_id = str(body.get("registrationId") or "").strip()
    event_id = str(body.get("eventId") or "").strip()
    member_name = str(body.get("memberName") or "").strip().upper()
    new_present = bool(body.get("present", False))

    if not registration_id or not event_id or not member_name:
        raise HTTPException(status_code=400, detail="Missing required parameters.")

    reg = await find_registration_flexible(registration_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found.")

    members = extract_event_members_with_attendance(reg, event_id)
    for m in members:
        if m.get("name") == member_name:
            m["present"] = new_present

    # Re-call mark with updated members
    now_iso = datetime.now(timezone.utc).isoformat()
    present_count = sum(1 for m in members if m.get("present"))
    is_attended = present_count > 0

    attendance_record = {
        "attended": is_attended,
        "markedAt": now_iso,
        "markedBy": admin["email"],
        "members": members,
    }

    event_regs = reg.get("eventRegistrations") or []
    target_ev_index = next((i for i, e in enumerate(event_regs) if e.get("eventId") == event_id), None)
    if target_ev_index is not None:
        event_regs[target_ev_index]["attendance"] = attendance_record

    top_attendance = reg.get("attendance") or {}
    top_attendance[event_id] = attendance_record

    update_payload = {
        "eventRegistrations": event_regs,
        "attendance": top_attendance,
        "updatedAt": now_iso,
    }

    if mongo.mongo_ready():
        updated = await mongo.db.registrations.find_one_and_update(
            {"registrationId": reg["registrationId"]},
            {"$set": update_payload},
            return_document=ReturnDocument.AFTER,
        )
    else:
        updated = await update_registration(reg["registrationId"], update_payload)

    formatted = format_registration_for_attendance(updated or reg, event_id)
    return {"message": "Attendance updated.", "registration": formatted}


@router.get("/attendance/export-excel")
async def export_attendance_excel(_admin=Depends(require_admin_tab("Attendance"))):
    configured_events = await list_events()
    all_regs = await load_registrations()
    excel_bytes = export_attendance_to_excel(configured_events, all_regs)

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=noctivus_event_wise_attendance.xlsx",
            "Cache-Control": "no-cache",
        },
    )


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
    await record_admin_action(
        admin["email"],
        "admin_access.upsert",
        normalized_email,
        {"tabs": ",".join(tabs), "name": str(body.get("name") or "")},
    )
    return {"user": user}


@router.delete("/access/{email}")
async def delete_access(email: str, admin=Depends(require_admin_tab("Admin Access"))):
    normalized_email = email.strip().lower()
    if is_owner_admin(normalized_email):
        raise HTTPException(status_code=400, detail="Owner access is controlled from ADMIN_EMAILS.")
    await deactivate_admin_access(normalized_email, admin["email"])
    await record_admin_action(admin["email"], "admin_access.deactivate", normalized_email)
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


@router.post("/registrations/{registration_id}/resend-pass")
@limiter.limit("20/minute")
async def resend_member_pass(registration_id: str, request: Request, admin=Depends(require_admin_tab("Verify Members"))):
    """Re-send the boarding pass invitation email for a specific registration (for testing or resends)."""
    rows = await load_registrations()
    registration = next((r for r in rows if r.get("registrationId") == registration_id), None)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found.")
    result = await send_member_pass(registration, admin_email=admin["email"])
    fresh_rows = await load_registrations()
    fresh_reg = next((r for r in fresh_rows if r.get("registrationId") == registration_id), registration)
    await record_admin_action(admin["email"], "registration.resend_pass", registration_id, result)
    return {"success": result.get("success", False), "result": result, "registration": serialize_registration(fresh_reg)}


@router.get("/invitations/stats")
async def invitations_stats(_admin=Depends(require_admin_tab("Invitations"))):
    all_rows = await load_registrations()
    total_registered = len(all_rows)
    rows = [r for r in all_rows if str(r.get("paymentStatus") or r.get("status") or "").lower() == "confirmed"]
    total_eligible = len(rows)
    sent_count = sum(1 for r in rows if r.get("pass_status") == "sent")
    failed_count = sum(1 for r in rows if r.get("pass_status") == "failed")
    unsent_count = sum(1 for r in rows if (r.get("pass_status") or "not_sent") != "sent")
    return {
        "totalRegistered": total_registered,
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

    sem = asyncio.Semaphore(4)

    async def _send_one(registration):
        async with sem:
            return await send_member_pass(registration, admin["email"])

    results = await asyncio.gather(*[_send_one(r) for r in batch])

    successful = []
    failed_list = []

    for result in results:
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

    sem = asyncio.Semaphore(4)

    async def _send_one(registration):
        async with sem:
            return await send_member_pass(registration, admin["email"])

    results = await asyncio.gather(*[_send_one(r) for r in targets])

    successful = []
    failed_list = []

    for result in results:
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


@router.api_route("/invitations/preview", methods=["GET", "POST"])
async def invitations_preview(request: Request, _admin=Depends(require_admin_tab("Invitations"))):
    registration_id = ""
    if request.method == "POST":
        try:
            body = await request.json()
            registration_id = str(body.get("registrationId") or "").strip()
        except Exception:
            registration_id = ""
    else:
        registration_id = str(request.query_params.get("registrationId") or "").strip()

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
                "feeSnapshot": 150,
                "venue": "Main Auditorium",
                "date": "26 SEP 2026",
                "time": "09:00 AM",
            }],
            "expectedAmount": 150,
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
async def announcements_send(request: Request, admin=Depends(require_admin)):
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
    csv = registrations_to_csv(await load_registrations({"eventId": eventId, "status": status}), sponsor_safe=sponsor_safe, event_id=eventId)
    await record_admin_action(admin["email"], "export.csv", eventId or "all", {"status": status or "all", "variant": variant})
    filename_event = re.sub(r"[^a-zA-Z0-9_-]", "-", eventId or "all")[:80]
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="noctivus-{filename_event}-registrations.csv"'})


@router.post("/analysis/ai")
async def analysis(_request: Request, _admin=Depends(require_admin_tab("AI Analysis"))):
    overview = build_overview(await load_registrations(), await list_events())
    return {"analysis": await create_ai_analysis(overview), "generatedAt": datetime.now(timezone.utc).isoformat(), "mode": "offline"}
