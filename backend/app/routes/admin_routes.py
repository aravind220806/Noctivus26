from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.config import settings
from app.core.rate_limit import limiter
from app.middleware.admin_auth import require_admin, require_admin_tab, require_any_admin_tab, sign_admin_token
from app.services.admin_access_service import ADMIN_TABS, deactivate_admin_access, is_owner_admin, list_admin_access, normalize_admin_tabs, resolve_admin_access, upsert_admin_access
from app.services.analysis_service import build_overview, create_ai_analysis
from app.services.email_service import normalize_pass_template, queue_email, send_confirmation, send_invitation
from app.services.export_service import registrations_to_csv
from app.services.google_auth_service import verify_google_credential
from app.services.registration_service import load_registrations, serialize_registration, update_registration

router = APIRouter()


@router.post("/auth/google")
@limiter.limit("10/minute")
async def google_auth(request: Request):
    body = await request.json()
    credential = str(body.get("credential") or "")
    if not credential:
        raise HTTPException(status_code=400, detail="Google credential is required.")
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on the server.")
    profile = await verify_google_credential(credential)
    if not profile.get("email") or not profile.get("email_verified"):
        raise HTTPException(status_code=401, detail="Use a verified Google account.")
    access = await resolve_admin_access(profile["email"])
    if not access:
        raise HTTPException(status_code=403, detail="This Google account is not allowed for admin access.")
    user = {"email": profile["email"], "name": profile.get("name") or profile["email"], "picture": profile.get("picture") or "", "tabs": access["tabs"], "owner": access["owner"]}
    return {"token": sign_admin_token(user), "user": user}


@router.get("/me")
async def me(admin=Depends(require_admin)):
    return {"user": admin, "tabs": admin["tabs"]}


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
    return build_overview(await load_registrations())


@router.get("/registrations")
async def registrations(eventId: str | None = None, status: str | None = None, _admin=Depends(require_any_admin_tab(["Verify Members", "Invitations", "Export"]))):
    rows = await load_registrations({"eventId": eventId, "status": status})
    return {"registrations": [serialize_registration(row) for row in rows]}


@router.patch("/registrations/{registration_id}/verify")
async def verify_registration(registration_id: str, request: Request, admin=Depends(require_admin_tab("Verify Members"))):
    body = await request.json()
    if body.get("status") not in ["confirmed", "mismatch", "duplicate"]:
        raise HTTPException(status_code=400, detail="Invalid registration status.")
    update = {"paymentStatus": body["status"], "verifiedAt": datetime.now(timezone.utc), "verifiedBy": admin["email"], "verificationNotes": str(body.get("notes") or "")[:500]}
    registration = await update_registration(registration_id, update)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found.")
    if update["paymentStatus"] == "confirmed" and body.get("sendEmail") is not False:
        queue_email(lambda: send_confirmation(registration))
    return {"registration": serialize_registration(registration)}


@router.post("/invitations/send")
async def invitations_send(request: Request, admin=Depends(require_admin_tab("Invitations"))):
    body = await request.json()
    registration_ids = [str(item) for item in body.get("registrationIds", [])][:200] if isinstance(body.get("registrationIds"), list) else []
    if not registration_ids:
        raise HTTPException(status_code=400, detail="Select at least one member.")
    pass_data = normalize_pass_template(body.get("pass") or {})
    selected = [row for row in await load_registrations() if row.get("registrationId") in registration_ids]
    if not selected:
        raise HTTPException(status_code=404, detail="No matching registrations found.")
    for registration in selected:
        queue_email(lambda registration=registration: send_invitation(registration, pass_data))
        await update_registration(registration["registrationId"], {"invitation": {"sentAt": datetime.now(timezone.utc), "sentBy": admin["email"], "passTitle": pass_data["title"], "passFields": pass_data["fields"]}})
    return {"sent": len(selected)}


@router.get("/export")
async def export(eventId: str | None = None, status: str | None = None, _admin=Depends(require_admin_tab("Export"))):
    csv = registrations_to_csv(await load_registrations({"eventId": eventId, "status": status}))
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="noctivus-{eventId or "all"}-registrations.csv"'})


@router.post("/analysis/ai")
async def analysis(_request: Request, _admin=Depends(require_admin_tab("AI Analysis"))):
    overview = build_overview(await load_registrations())
    return {"analysis": await create_ai_analysis(overview), "generatedAt": datetime.now(timezone.utc).isoformat(), "mode": "offline"}
