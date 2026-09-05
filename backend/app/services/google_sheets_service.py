import asyncio
import base64
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key

from app.core.config import settings

logger = logging.getLogger("google_sheets_sync")

# In-memory token cache and sync state
_TOKEN_CACHE = {"token": None, "expires_at": 0}
_LAST_SYNC_STATUS = {
    "last_synced_at": None,
    "last_sync_type": None,
    "last_error": None,
    "total_sync_count": 0,
}

# Serialize concurrent check-in syncs: at most one running + one queued.
# Multiple callers that arrive while a sync is in flight all collapse into a
# single follow-up run (full DB re-read guarantees the result is current).
_sync_lock: asyncio.Lock | None = None
_sync_pending: bool = False


def _get_sync_lock() -> asyncio.Lock:
    global _sync_lock
    if _sync_lock is None:
        _sync_lock = asyncio.Lock()
    return _sync_lock


def _extract_spreadsheet_id(raw_id_or_url: str | None) -> str:
    if not raw_id_or_url:
        return ""
    val = raw_id_or_url.strip()
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", val)
    if match:
        return match.group(1)
    return val


def _get_service_account_info() -> dict | None:
    # 1. Check raw JSON or base64 env string
    raw_json = settings.google_service_account_json or os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if raw_json:
        raw_json = raw_json.strip()
        try:
            if raw_json.startswith("{"):
                return json.loads(raw_json)
            # Try base64 decode
            decoded = base64.b64decode(raw_json).decode("utf-8")
            return json.loads(decoded)
        except Exception as err:
            logger.warning(f"Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: {err}")

    # 2. Check file path in settings or env
    file_path_str = settings.google_service_account_file or os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
    candidate_paths = []
    if file_path_str:
        candidate_paths.append(Path(file_path_str))

    root = settings.ROOT if hasattr(settings, "ROOT") else Path(__file__).resolve().parents[2]
    candidate_paths.extend([
        root / "google_service_account.json",
        root.parent / "google_service_account.json",
        root / "service_account.json",
    ])

    for path in candidate_paths:
        if path.exists() and path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if data.get("client_email") and data.get("private_key"):
                    return data
            except Exception as err:
                logger.warning(f"Error reading service account file at {path}: {err}")

    return None


def _create_jwt_assertion(service_account_info: dict) -> str:
    client_email = service_account_info.get("client_email")
    private_key_pem = service_account_info.get("private_key")
    token_uri = service_account_info.get("token_uri", "https://oauth2.googleapis.com/token")

    if not client_email or not private_key_pem:
        raise ValueError("Invalid Service Account: client_email and private_key are required.")

    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": client_email,
        "scope": "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
        "aud": token_uri,
        "exp": now + 3600,
        "iat": now,
    }

    def b64url(data: bytes | str) -> str:
        if isinstance(data, str):
            data = data.encode("utf-8")
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    header_b64 = b64url(json.dumps(header))
    payload_b64 = b64url(json.dumps(payload))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    key = load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
    signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    sig_b64 = b64url(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


async def get_google_access_token() -> str | None:
    now = time.time()
    if _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > now + 60:
        return _TOKEN_CACHE["token"]

    sa_info = _get_service_account_info()
    if not sa_info:
        return None

    assertion = _create_jwt_assertion(sa_info)
    token_uri = sa_info.get("token_uri", "https://oauth2.googleapis.com/token")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            token_uri,
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
        )
        if resp.status_code != 200:
            logger.error(f"Failed to obtain Google access token: {resp.text}")
            return None
        data = resp.json()
        token = data.get("access_token")
        expires_in = data.get("expires_in", 3600)
        _TOKEN_CACHE["token"] = token
        _TOKEN_CACHE["expires_at"] = now + expires_in
        return token


def _sanitize_sheet_title(name: str) -> str:
    clean = re.sub(r'[:\\/?*\[\]]', '', str(name or 'Event')).strip()
    return clean[:31] if clean else 'Event'


def _safe_cell(val: Any) -> Any:
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        return val
    s = str(val)
    if s.startswith(("=", "+", "-", "@")):
        return "'" + s
    return s


class GoogleSheetsService:
    @property
    def spreadsheet_id(self) -> str:
        return _extract_spreadsheet_id(
            _LAST_SYNC_STATUS.get("dynamic_spreadsheet_id")
            or settings.google_sheets_spreadsheet_id
            or os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID")
        )

    def set_active_spreadsheet_id(self, sid: str):
        _LAST_SYNC_STATUS["dynamic_spreadsheet_id"] = _extract_spreadsheet_id(sid)

    @property
    def is_configured(self) -> bool:
        return _get_service_account_info() is not None

    @property
    def is_enabled(self) -> bool:
        return bool(settings.google_sheets_live_sync_enabled and self.is_configured)

    async def create_new_spreadsheet(self, title: str = "Noctivus '26 Live Database") -> dict | None:
        """Automatically creates a new Google Spreadsheet in Google Cloud."""
        token = await get_google_access_token()
        if not token:
            return None
        url = "https://sheets.googleapis.com/v4/spreadsheets"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        body = {
            "properties": {"title": title},
            "sheets": [
                {"properties": {"title": "Registered"}},
                {"properties": {"title": "Verified"}},
                {"properties": {"title": "Check-In List"}},
                {"properties": {"title": "Master Event Slots"}},
                {"properties": {"title": "Scheduler Summary"}},
                {"properties": {"title": "Member Allocations"}},
            ],
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code == 200:
                data = resp.json()
                new_id = data.get("spreadsheetId")
                self.set_active_spreadsheet_id(new_id)
                return data
            logger.error(f"Failed to create new spreadsheet: {resp.status_code} {resp.text}")
            return None

    def get_status(self) -> dict:
        sa_info = _get_service_account_info()
        sid = self.spreadsheet_id
        return {
            "configured": self.is_configured,
            "enabled": self.is_enabled,
            "spreadsheetId": sid,
            "spreadsheetUrl": f"https://docs.google.com/spreadsheets/d/{sid}" if sid else "",
            "serviceAccountEmail": sa_info.get("client_email") if sa_info else None,
            "lastSyncedAt": _LAST_SYNC_STATUS["last_synced_at"],
            "lastSyncType": _LAST_SYNC_STATUS["last_sync_type"],
            "lastError": _LAST_SYNC_STATUS["last_error"],
            "totalSyncCount": _LAST_SYNC_STATUS["total_sync_count"],
        }

    async def _api_request(self, method: str, path: str, json_body: dict | None = None, params: dict | None = None) -> dict | None:
        token = await get_google_access_token()
        if not token or not self.spreadsheet_id:
            return None

        url = f"https://sheets.googleapis.com/v4/spreadsheets/{self.spreadsheet_id}{path}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, json=json_body, params=params)
            if resp.status_code >= 400:
                err_msg = f"Google Sheets API error ({resp.status_code}): {resp.text}"
                logger.error(err_msg)
                _LAST_SYNC_STATUS["last_error"] = err_msg
                return None
            return resp.json()

    async def get_existing_sheet_titles(self, force_refresh: bool = False) -> list[str]:
        if not force_refresh and _LAST_SYNC_STATUS.get("known_sheet_titles"):
            return _LAST_SYNC_STATUS["known_sheet_titles"]
        data = await self._api_request("GET", "?fields=sheets.properties")
        if not data or "sheets" not in data:
            return []
        titles = [s.get("properties", {}).get("title", "") for s in data["sheets"]]
        _LAST_SYNC_STATUS["known_sheet_titles"] = titles
        return titles

    async def ensure_sheets_exist(self, sheet_titles: list[str]) -> bool:
        """Creates any missing sheet tabs in the target spreadsheet."""
        existing = await self.get_existing_sheet_titles()
        missing = [t for t in sheet_titles if t not in existing]
        if not missing:
            return True

        requests = [{"addSheet": {"properties": {"title": title}}} for title in missing]
        res = await self._api_request("POST", ":batchUpdate", json_body={"requests": requests})
        if res:
            _LAST_SYNC_STATUS["known_sheet_titles"] = list(set(existing + missing))
            return True
        return False

    async def batch_write_all_sheets(self, sheets_data: dict[str, list[list[Any]]]) -> bool:
        """Writes multiple sheets in a single atomic batch API request."""
        # 1. Ensure all sheet tabs exist in 1 call
        await self.ensure_sheets_exist(list(sheets_data.keys()))

        # 2. Batch clear all sheet ranges in 1 call
        clear_body = {
            "ranges": [f"'{title}'!A1:Z10000" for title in sheets_data.keys()]
        }
        await self._api_request("POST", "/values:batchClear", json_body=clear_body)

        # 3. Batch update all sheet values in 1 call
        data_payload = [
            {
                "range": f"'{title}'!A1",
                "values": [[_safe_cell(c) for c in r] for r in rows],
            }
            for title, rows in sheets_data.items()
        ]
        body = {
            "valueInputOption": "USER_ENTERED",
            "data": data_payload,
        }
        res = await self._api_request("POST", "/values:batchUpdate", json_body=body)
        return res is not None

    async def clear_and_write_sheet(self, sheet_title: str, rows: list[list[Any]]) -> bool:
        """Clears sheet and writes formatted data rows."""
        return await self.batch_write_all_sheets({sheet_title: rows})

    async def sync_current_database(self, sync_type: str) -> bool:
        """Re-read local state and publish the canonical Google Sheets view."""
        if not self.is_enabled:
            return False
        global _sync_pending
        _sync_pending = True
        lock = _get_sync_lock()
        if lock.locked():
            return True
        async with lock:
            success = True
            while _sync_pending:
                _sync_pending = False
                try:
                    from app.services.event_service import list_events
                    from app.services.registration_service import load_registrations
                    from app.db.sqlite_db import sqlite_db

                    events = await list_events()
                    registrations = await load_registrations()
                    slots = await sqlite_db.list_all("event_slots") if sqlite_db.ready() else []
                    success = await self.sync_full_database(events, registrations, slots, sync_type=sync_type)
                except Exception as err:
                    success = False
                    logger.error(f"Live sync {sync_type} error: {err}")
                    _LAST_SYNC_STATUS["last_error"] = str(err)
        return success

    # ================= ROW FORMATTERS =================

    @staticmethod
    def _format_registration_row(reg: dict, idx: int | None = None) -> list[Any]:
        p = reg.get("participant") or {}
        event_names = [e.get("eventName") or e.get("eventId") for e in reg.get("eventRegistrations", [])]
        is_checked_in = bool(reg.get("checkedIn"))
        is_food_claimed = bool(reg.get("foodClaimed"))
        p_status = (reg.get("paymentStatus") or "pending").capitalize()
        abstract_val = (
            reg.get("abstract")
            or reg.get("igniteTopic")
            or p.get("abstract")
            or p.get("igniteTopic")
            or ""
        )

        return [
            idx if idx is not None else "",
            reg.get("registrationId") or reg.get("member_id", ""),
            p.get("name", ""),
            p.get("email", ""),
            p.get("phone", ""),
            p.get("college", ""),
            p.get("department", ""),
            p.get("year", ""),
            p.get("foodPreference", ""),
            "YES" if is_food_claimed else "NO",
            reg.get("foodClaimedAt", ""),
            "; ".join(event_names),
            abstract_val,
            p_status,
            reg.get("utrNumber", ""),
            reg.get("expectedAmount", 0),
            reg.get("claimedAmount", 0),
            "YES" if is_checked_in else "NO",
            reg.get("checkedInAt", ""),
            reg.get("paymentSubmittedAt", "") or reg.get("createdAt", ""),
            reg.get("verifiedAt", ""),
        ]

    @staticmethod
    def _format_verified_row(reg: dict, idx: int | None = None) -> list[Any]:
        p = reg.get("participant") or {}
        event_names = [e.get("eventName") or e.get("eventId") for e in reg.get("eventRegistrations", [])]
        is_checked_in = bool(reg.get("checkedIn"))
        is_food_claimed = bool(reg.get("foodClaimed"))

        return [
            idx if idx is not None else "",
            reg.get("registrationId") or reg.get("member_id", ""),
            p.get("name", ""),
            p.get("email", ""),
            p.get("phone", ""),
            p.get("college", ""),
            p.get("department", ""),
            p.get("year", ""),
            p.get("foodPreference", ""),
            "YES" if is_food_claimed else "NO",
            reg.get("foodClaimedAt", ""),
            "; ".join(event_names),
            reg.get("utrNumber", ""),
            reg.get("expectedAmount", 0),
            reg.get("verifiedAt", ""),
            "YES" if is_checked_in else "NO",
            reg.get("checkedInAt", ""),
        ]

    @staticmethod
    def _format_checkin_row(reg: dict, idx: int | None = None) -> list[Any]:
        p = reg.get("participant") or {}
        event_names = [e.get("eventName") or e.get("eventId") for e in reg.get("eventRegistrations", [])]

        return [
            idx if idx is not None else "",
            reg.get("registrationId") or reg.get("member_id", ""),
            p.get("name", ""),
            p.get("email", ""),
            p.get("phone", ""),
            p.get("college", ""),
            p.get("department", ""),
            p.get("foodPreference", ""),
            "; ".join(event_names),
            (reg.get("paymentStatus") or "pending").capitalize(),
            reg.get("checkedInAt", ""),
            reg.get("checkedInBy", "Gate Desk"),
        ]

    @staticmethod
    def _format_food_row(reg: dict, idx: int | None = None) -> list[Any]:
        p = reg.get("participant") or {}
        pref = (reg.get("foodPreference") or p.get("foodPreference") or "Veg").capitalize()
        return [
            idx if idx is not None else "",
            reg.get("registrationId") or reg.get("member_id", ""),
            p.get("name", ""),
            p.get("email", ""),
            p.get("phone", ""),
            p.get("college", ""),
            pref,
            "YES" if reg.get("foodClaimed") else "NO",
            reg.get("foodClaimedAt", ""),
            reg.get("foodClaimedBy", "Food Desk"),
            (reg.get("paymentStatus") or "pending").capitalize(),
        ]

    # ================= LIVE EVENT SYNC HOOKS =================

    async def sync_new_registration(self, registration: dict):
        """Live trigger: publish the full canonical workbook after registration."""
        await self.sync_current_database("registration")

    async def sync_verified_registration(self, registration: dict):
        """Live trigger: publish the full canonical workbook after verification."""
        await self.sync_current_database("verification")

    async def sync_check_in(self, registration: dict):
        """Live trigger: publish the full canonical workbook after gate or event attendance."""
        await self.sync_current_database("attendance")

    def build_live_workbook(self, events: list[dict], registrations: list[dict]) -> dict[str, list[list[Any]]]:
        """Build the clean Sheets workbook for the registration -> verification -> attendance flow."""
        sheets: dict[str, list[list[Any]]] = {}

        registered_headers = [
            "S.No", "Registration ID", "Participant Name", "Email", "Phone",
            "College", "Department", "Year", "Food Preference", "Registered Events",
            "Payment Status", "UTR Number", "Expected Amount", "Claimed Amount", "Submitted At",
        ]
        registered_rows = [registered_headers]
        for idx, reg in enumerate(registrations, 1):
            p = reg.get("participant") or {}
            event_names = [e.get("eventName") or e.get("eventId") for e in reg.get("eventRegistrations", [])]
            registered_rows.append([
                idx,
                reg.get("registrationId") or reg.get("member_id", ""),
                p.get("name", ""),
                p.get("email", ""),
                p.get("phone", ""),
                p.get("college", ""),
                p.get("department", ""),
                p.get("year", ""),
                p.get("foodPreference", ""),
                "; ".join(event_names),
                (reg.get("paymentStatus") or "pending").capitalize(),
                reg.get("utrNumber", ""),
                reg.get("expectedAmount", 0),
                reg.get("claimedAmount", 0),
                reg.get("paymentSubmittedAt", "") or reg.get("createdAt", ""),
            ])
        sheets["Registered"] = registered_rows

        verified_regs = [r for r in registrations if (r.get("paymentStatus") or "").lower() == "confirmed"]
        verified_headers = [
            "S.No", "Registration ID", "Participant Name", "Email", "Phone",
            "College", "Department", "Year", "Food Preference", "Registered Events",
            "UTR Number", "Verified Amount", "Verified At", "Verified By",
        ]
        verified_rows = [verified_headers]
        for idx, reg in enumerate(verified_regs, 1):
            p = reg.get("participant") or {}
            event_names = [e.get("eventName") or e.get("eventId") for e in reg.get("eventRegistrations", [])]
            verified_rows.append([
                idx,
                reg.get("registrationId") or reg.get("member_id", ""),
                p.get("name", ""),
                p.get("email", ""),
                p.get("phone", ""),
                p.get("college", ""),
                p.get("department", ""),
                p.get("year", ""),
                p.get("foodPreference", ""),
                "; ".join(event_names),
                reg.get("utrNumber", ""),
                reg.get("expectedAmount", 0),
                reg.get("verifiedAt", ""),
                reg.get("verifiedBy", ""),
            ])
        sheets["Verified"] = verified_rows

        for event in events:
            event_id = event.get("id")
            event_name = event.get("name") or event_id or "Event"
            event_sheet = _sanitize_sheet_title(event_name)
            attendance_sheet = _sanitize_sheet_title(f"Attendance - {event_name}")
            event_regs = [
                reg for reg in verified_regs
                if any(item.get("eventId") == event_id for item in reg.get("eventRegistrations", []))
            ]

            event_headers = [
                "S.No", "Registration ID", "Participant Name", "Email", "Phone",
                "College", "Department", "Year", "Food Preference", "Verified At",
            ]
            event_rows = [event_headers]
            for idx, reg in enumerate(event_regs, 1):
                p = reg.get("participant") or {}
                event_rows.append([
                    idx,
                    reg.get("registrationId") or reg.get("member_id", ""),
                    p.get("name", ""),
                    p.get("email", ""),
                    p.get("phone", ""),
                    p.get("college", ""),
                    p.get("department", ""),
                    p.get("year", ""),
                    p.get("foodPreference", ""),
                    reg.get("verifiedAt", ""),
                ])
            sheets[event_sheet] = event_rows

            attendance_headers = [
                "S.No", "Registration ID", "Member Name", "Role", "Roll No / ID",
                "College", "Department", "Year", "Email", "Phone", "Attendance Status",
                "Marked At", "Marked By", "E-Certificate Eligible",
            ]
            attendance_rows = [attendance_headers]
            attendance_members = []
            for reg in event_regs:
                p = reg.get("participant") or {}
                ev_item = next((item for item in reg.get("eventRegistrations", []) if item.get("eventId") == event_id), None)
                if not ev_item:
                    continue
                att_data = ev_item.get("attendance") or (reg.get("attendance") or {}).get(event_id) or {}
                member_states = {
                    (m.get("name") or "").strip().upper(): m
                    for m in att_data.get("members", [])
                    if isinstance(m, dict)
                }
                marked_at = att_data.get("markedAt") or ""
                marked_by = att_data.get("markedBy") or ""

                leader_name = (p.get("name") or "").strip()
                leader_state = member_states.get(leader_name.upper(), {})
                attendance_members.append({
                    "registrationId": reg.get("registrationId") or reg.get("member_id", ""),
                    "name": leader_name,
                    "role": "Team Leader",
                    "rollNo": p.get("rollNo") or p.get("collegeId") or "",
                    "college": p.get("college", ""),
                    "department": p.get("department", ""),
                    "year": p.get("year", ""),
                    "email": p.get("email", ""),
                    "phone": p.get("phone", ""),
                    "present": bool(leader_state.get("present", att_data.get("present", False))),
                    "markedAt": marked_at,
                    "markedBy": marked_by,
                })

                for tm in ev_item.get("teamMembers") or []:
                    if not isinstance(tm, dict):
                        continue
                    tm_name = (tm.get("name") or "").strip()
                    if not tm_name:
                        continue
                    tm_state = member_states.get(tm_name.upper(), {})
                    attendance_members.append({
                        "registrationId": reg.get("registrationId") or reg.get("member_id", ""),
                        "name": tm_name,
                        "role": "Team Member",
                        "rollNo": tm.get("rollNo", ""),
                        "college": p.get("college", ""),
                        "department": p.get("department", ""),
                        "year": p.get("year", ""),
                        "email": p.get("email", ""),
                        "phone": p.get("phone", ""),
                        "present": bool(tm_state.get("present", False)),
                        "markedAt": marked_at,
                        "markedBy": marked_by,
                    })

            attendance_members.sort(key=lambda item: (item["registrationId"], 0 if item["role"] == "Team Leader" else 1, item["name"]))
            for idx, member in enumerate(attendance_members, 1):
                present = member["present"]
                attendance_rows.append([
                    idx,
                    member["registrationId"],
                    member["name"],
                    member["role"],
                    member["rollNo"],
                    member["college"],
                    member["department"],
                    member["year"],
                    member["email"],
                    member["phone"],
                    "PRESENT" if present else "ABSENT",
                    member["markedAt"],
                    member["markedBy"],
                    "YES" if present else "NO",
                ])
            sheets[attendance_sheet] = attendance_rows

        return sheets

    async def sync_full_database(self, events: list[dict], registrations: list[dict], slots: list[dict], sync_type: str = "full_database") -> bool:
        """Full database resync for clean live Google Sheets."""
        if not self.is_enabled:
            return False

        try:
            all_sheets_payload = self.build_live_workbook(events, registrations)
            await self.batch_write_all_sheets(all_sheets_payload)
            _LAST_SYNC_STATUS["last_synced_at"] = datetime.now(timezone.utc).isoformat()
            _LAST_SYNC_STATUS["last_sync_type"] = sync_type
            _LAST_SYNC_STATUS["last_error"] = None
            _LAST_SYNC_STATUS["total_sync_count"] += 1
            return True
        except Exception as err:
            logger.error(f"Full database sync error: {err}")
            _LAST_SYNC_STATUS["last_error"] = str(err)
            return False


google_sheets_service = GoogleSheetsService()
