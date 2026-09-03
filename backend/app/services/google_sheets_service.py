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

    # ================= ROW FORMATTERS =================

    @staticmethod
    def _format_registration_row(reg: dict, idx: int | None = None) -> list[Any]:
        p = reg.get("participant") or {}
        event_names = [e.get("eventName") or e.get("eventId") for e in reg.get("eventRegistrations", [])]
        is_checked_in = bool(reg.get("checkedIn"))
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
            "; ".join(event_names),
            reg.get("utrNumber", ""),
            reg.get("expectedAmount", 0),
            reg.get("verifiedAt", ""),
            "YES" if is_checked_in else "NO",
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

    # ================= LIVE EVENT SYNC HOOKS =================

    async def sync_new_registration(self, registration: dict):
        """Live trigger: Append new registration to 'Registered' sheet."""
        if not self.is_enabled:
            return
        try:
            await self.ensure_sheets_exist(["Registered"])
            row = self._format_registration_row(registration)
            await self._api_request(
                "POST",
                "/values/'Registered'!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
                json_body={"values": [row]},
            )
            _LAST_SYNC_STATUS["last_synced_at"] = datetime.now(timezone.utc).isoformat()
            _LAST_SYNC_STATUS["last_sync_type"] = "registration"
            _LAST_SYNC_STATUS["total_sync_count"] += 1
        except Exception as err:
            logger.error(f"Live sync registration error: {err}")
            _LAST_SYNC_STATUS["last_error"] = str(err)

    async def sync_verified_registration(self, registration: dict):
        """Live trigger: Append to 'Verified' sheet and update sync."""
        if not self.is_enabled:
            return
        try:
            await self.ensure_sheets_exist(["Verified"])
            row = self._format_verified_row(registration)
            await self._api_request(
                "POST",
                "/values/'Verified'!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
                json_body={"values": [row]},
            )
            _LAST_SYNC_STATUS["last_synced_at"] = datetime.now(timezone.utc).isoformat()
            _LAST_SYNC_STATUS["last_sync_type"] = "verification"
            _LAST_SYNC_STATUS["total_sync_count"] += 1
        except Exception as err:
            logger.error(f"Live sync verification error: {err}")
            _LAST_SYNC_STATUS["last_error"] = str(err)

    async def sync_check_in(self, registration: dict):
        """Live trigger: Append to 'Check-In List' sheet."""
        if not self.is_enabled:
            return
        try:
            await self.ensure_sheets_exist(["Check-In List"])
            row = self._format_checkin_row(registration)
            await self._api_request(
                "POST",
                "/values/'Check-In List'!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
                json_body={"values": [row]},
            )
            _LAST_SYNC_STATUS["last_synced_at"] = datetime.now(timezone.utc).isoformat()
            _LAST_SYNC_STATUS["last_sync_type"] = "check-in"
            _LAST_SYNC_STATUS["total_sync_count"] += 1
        except Exception as err:
            logger.error(f"Live sync check-in error: {err}")
            _LAST_SYNC_STATUS["last_error"] = str(err)

    async def sync_full_database(self, events: list[dict], registrations: list[dict], slots: list[dict]) -> bool:
        """Full database resync pushing all tables, event slots, and attendance sheets in batch."""
        if not self.is_enabled:
            return False

        try:
            events_map = {e["id"]: e for e in events}
            slots_map = {s["id"]: s for s in slots}
            all_sheets_payload: dict[str, list[list[Any]]] = {}

            # 1. Prepare 'Registered' sheet
            reg_headers = [
                "S.No", "Registration ID", "Participant Name", "Email", "Phone",
                "College", "Department", "Year", "Food Preference", "Registered Events",
                "Abstract / Topic", "Payment Status", "UTR Number", "Expected Amount",
                "Claimed Amount", "Gate Check-In", "Checked In At", "Submitted At", "Verified At"
            ]
            reg_rows = [reg_headers]
            for idx, r in enumerate(registrations, 1):
                reg_rows.append(self._format_registration_row(r, idx))
            all_sheets_payload["Registered"] = reg_rows

            # 2. Prepare 'Verified' sheet
            ver_headers = [
                "S.No", "Registration ID", "Participant Name", "Email", "Phone",
                "College", "Department", "Year", "Food", "Registered Events",
                "UTR Number", "Verified Amount", "Verified At", "Gate Check-In"
            ]
            verified_regs = [r for r in registrations if (r.get("paymentStatus") or "").lower() == "confirmed"]
            ver_rows = [ver_headers]
            for idx, r in enumerate(verified_regs, 1):
                ver_rows.append(self._format_verified_row(r, idx))
            all_sheets_payload["Verified"] = ver_rows

            # 3. Prepare 'Check-In List' sheet
            chk_headers = [
                "S.No", "Registration ID", "Participant Name", "Email", "Phone",
                "College", "Department", "Food", "Registered Events", "Payment Status",
                "Checked In At", "Checked In By"
            ]
            checked_in_regs = [r for r in registrations if bool(r.get("checkedIn"))]
            chk_rows = [chk_headers]
            for idx, r in enumerate(checked_in_regs, 1):
                chk_rows.append(self._format_checkin_row(r, idx))
            all_sheets_payload["Check-In List"] = chk_rows

            # 4. Prepare 'Master Event Slots' sheet
            slots_headers = [
                "Event Name", "Category", "Window", "Date", "Start Time", "End Time",
                "Slot Timing", "Capacity", "Assigned Count", "Available", "Assigned Member IDs", "Assigned Member Names"
            ]
            reg_by_id = {(r.get("registrationId") or r.get("member_id")): r for r in registrations}
            sorted_slots = sorted(
                slots,
                key=lambda s: (
                    events_map.get(s.get("event_id"), {}).get("name", s.get("event_id", "")),
                    0 if str(s.get("window")).lower() == "morning" else 1,
                    s.get("start_time", ""),
                ),
            )
            slot_rows = [slots_headers]
            for s in sorted_slots:
                ev = events_map.get(s.get("event_id"), {})
                assigned_ids = s.get("assigned_member_ids") or []
                assigned_count = len(assigned_ids)
                capacity = s.get("capacity") or 30
                available = max(0, capacity - assigned_count)
                member_names = []
                for mid in assigned_ids:
                    reg = reg_by_id.get(mid)
                    pname = (reg.get("participant") or {}).get("name", mid) if reg else mid
                    member_names.append(f"{pname} ({mid})")

                slot_rows.append([
                    ev.get("name", s.get("event_id")),
                    ev.get("category", "tech"),
                    "Morning" if str(s.get("window")).lower() == "morning" else "Afternoon",
                    s.get("date", "2026-09-26"),
                    s.get("start_time", ""),
                    s.get("end_time", ""),
                    f"{s.get('start_time', '')} - {s.get('end_time', '')}",
                    capacity,
                    assigned_count,
                    available,
                    ", ".join(assigned_ids) if assigned_ids else "None",
                    "; ".join(member_names) if member_names else "None",
                ])
            all_sheets_payload["Master Event Slots"] = slot_rows

            # 5. Prepare 'Scheduler Summary' sheet
            sched_sum_headers = [
                "Event ID", "Event Name", "Category", "Duration (Mins)", "Total Registrations",
                "Total Slots", "Morning Slots", "Afternoon Slots", "Total Capacity", "Total Assigned", "Utilization %"
            ]
            slots_by_ev = {}
            for s in slots:
                eid = s.get("event_id")
                slots_by_ev.setdefault(eid, []).append(s)

            sum_rows = [sched_sum_headers]
            for ev in events:
                eid = ev["id"]
                ev_slots = slots_by_ev.get(eid, [])
                m_count = sum(1 for s in ev_slots if str(s.get("window")).lower() == "morning")
                a_count = sum(1 for s in ev_slots if str(s.get("window")).lower() == "afternoon")
                tot_cap = sum(s.get("capacity", 30) for s in ev_slots)
                tot_ass = sum(len(s.get("assigned_member_ids", [])) for s in ev_slots)
                util = f"{(tot_ass / tot_cap * 100):.1f}%" if tot_cap > 0 else "0.0%"
                sum_rows.append([
                    eid,
                    ev.get("name", eid),
                    ev.get("category", "tech"),
                    ev.get("duration_minutes", 90),
                    ev.get("total_registrations", 0),
                    len(ev_slots),
                    m_count,
                    a_count,
                    tot_cap,
                    tot_ass,
                    util,
                ])
            all_sheets_payload["Scheduler Summary"] = sum_rows

            # 6. Prepare 'Member Allocations' sheet
            alloc_headers = [
                "Registration ID", "Member Name", "Email", "College", "Registered Events",
                "Abstract / Topic", "Assigned Slot IDs", "Slot Details (Window & Timing)"
            ]
            alloc_rows = [alloc_headers]
            for r in verified_regs:
                p = r.get("participant") or {}
                assigned_slot_ids = r.get("assigned_slots") or []
                slot_descriptions = []
                for sid in assigned_slot_ids:
                    sl = slots_map.get(sid)
                    if sl:
                        ev_name = events_map.get(sl.get("event_id"), {}).get("name", sl.get("event_id"))
                        win = "Morning" if sl.get("window") == "morning" else "Afternoon"
                        slot_descriptions.append(f"{ev_name}: {win} ({sl.get('start_time')} - {sl.get('end_time')})")
                    else:
                        slot_descriptions.append(sid)

                event_names = [e.get("eventName") or e.get("eventId") for e in r.get("eventRegistrations", [])]
                abstract_val = r.get("abstract") or r.get("igniteTopic") or p.get("abstract") or p.get("igniteTopic") or ""
                alloc_rows.append([
                    r.get("registrationId") or r.get("member_id"),
                    p.get("name", ""),
                    p.get("email", ""),
                    p.get("college", ""),
                    ", ".join(event_names),
                    abstract_val,
                    ", ".join(assigned_slot_ids) if assigned_slot_ids else "Unassigned",
                    "; ".join(slot_descriptions) if slot_descriptions else "Unassigned",
                ])
            all_sheets_payload["Member Allocations"] = alloc_rows

            # 7+. Per-Event Attendance Sheets
            for s_idx, ev in enumerate(events, 1):
                eid = ev.get("id")
                ename = ev.get("name", eid)
                clean_sheet_name = _sanitize_sheet_title(f"Att - {ename}")

                ev_headers = [
                    "S.No", "Registration ID", "Member Name", "Role", "Roll No / ID",
                    "College", "Department", "Year", "Email", "Phone", "Payment Status",
                    "Gate Check-In", "Event Attendance", "E-Certificate Eligible",
                    "Attendance Marked At", "Marked By"
                ]
                ev_rows = [ev_headers]

                event_regs = [r for r in registrations if any(e.get("eventId") == eid for e in r.get("eventRegistrations", []))]
                all_event_members = []
                for r in event_regs:
                    p = r.get("participant") or {}
                    event_regs_list = r.get("eventRegistrations") or []
                    ev_item = next((e for e in event_regs_list if e.get("eventId") == eid), None)
                    if not ev_item:
                        continue
                    att_data = ev_item.get("attendance") or (r.get("attendance") or {}).get(eid) or {}
                    members_att = {
                        (m.get("name") or "").strip().upper(): m.get("present", False)
                        for m in att_data.get("members", []) if isinstance(m, dict)
                    }
                    marked_at = att_data.get("markedAt") or ""
                    marked_by = att_data.get("markedBy") or ""

                    leader_name = (p.get("name") or "").strip().upper()
                    leader_present = members_att.get(leader_name, att_data.get("present", False) if "members" not in att_data else False)
                    all_event_members.append({
                        "registrationId": r.get("registrationId") or r.get("member_id", ""),
                        "name": leader_name,
                        "role": "Team Leader",
                        "rollNo": p.get("rollNo") or p.get("collegeId") or "",
                        "college": p.get("college", ""),
                        "department": p.get("department", ""),
                        "year": p.get("year", ""),
                        "email": p.get("email", ""),
                        "phone": p.get("phone", ""),
                        "paymentStatus": r.get("paymentStatus", "pending"),
                        "checkedIn": "Yes" if r.get("checkedIn") else "No",
                        "present": leader_present,
                        "markedAt": marked_at,
                        "markedBy": marked_by,
                    })

                    for tm in (ev_item.get("teamMembers") or []):
                        if not isinstance(tm, dict):
                            continue
                        tm_name = (tm.get("name") or "").strip().upper()
                        if not tm_name:
                            continue
                        all_event_members.append({
                            "registrationId": r.get("registrationId") or r.get("member_id", ""),
                            "name": tm_name,
                            "role": "Team Member",
                            "rollNo": tm.get("rollNo", ""),
                            "college": p.get("college", ""),
                            "department": p.get("department", ""),
                            "year": p.get("year", ""),
                            "email": p.get("email", ""),
                            "phone": p.get("phone", ""),
                            "paymentStatus": r.get("paymentStatus", "pending"),
                            "checkedIn": "Yes" if r.get("checkedIn") else "No",
                            "present": members_att.get(tm_name, False),
                            "markedAt": marked_at,
                            "markedBy": marked_by,
                        })

                sorted_m = sorted(
                    all_event_members,
                    key=lambda x: (0 if x.get("present") else 1, x.get("registrationId", ""), 0 if x.get("role") == "Team Leader" else 1)
                )

                for m_idx, m in enumerate(sorted_m, 1):
                    is_present = m.get("present", False)
                    is_confirmed = (m.get("paymentStatus") or "").lower() == "confirmed"
                    ev_rows.append([
                        m_idx,
                        m.get("registrationId", ""),
                        m.get("name", ""),
                        m.get("role", ""),
                        m.get("rollNo", ""),
                        m.get("college", ""),
                        m.get("department", ""),
                        m.get("year", ""),
                        m.get("email", ""),
                        m.get("phone", ""),
                        (m.get("paymentStatus") or "").capitalize(),
                        m.get("checkedIn", "No"),
                        "PRESENT" if is_present else "ABSENT",
                        "YES" if (is_present and is_confirmed) else "NO",
                        m.get("markedAt", ""),
                        m.get("markedBy", ""),
                    ])

                all_sheets_payload[clean_sheet_name] = ev_rows

            # 8+. Per-Event Slot Allocation Sheets
            for s_idx, ev in enumerate(events, 1):
                eid = ev.get("id")
                ename = ev.get("name", eid)
                clean_slot_sheet_name = _sanitize_sheet_title(f"Slots - {ename}")

                slot_headers = [
                    "S.No", "Slot Window", "Timing", "Date", "Capacity", "Assigned", "Available",
                    "Assigned Reg ID", "Member Name", "College", "Department", "Year",
                    "Email", "Phone", "Payment Status", "Gate Check-In"
                ]
                slot_sheet_rows = [slot_headers]

                ev_slots = [s for s in slots if s.get("event_id") == eid]
                ev_slots_sorted = sorted(
                    ev_slots,
                    key=lambda s: (0 if str(s.get("window")).lower() == "morning" else 1, s.get("start_time", ""))
                )

                row_counter = 1
                for sl in ev_slots_sorted:
                    assigned_ids = sl.get("assigned_member_ids") or []
                    assigned_count = len(assigned_ids)
                    capacity = sl.get("capacity") or 30
                    available = max(0, capacity - assigned_count)
                    window_label = "Morning" if str(sl.get("window")).lower() == "morning" else "Afternoon"
                    timing_label = f"{sl.get('start_time', '')} - {sl.get('end_time', '')}"
                    date_label = sl.get("date", "2026-09-26")

                    if not assigned_ids:
                        slot_sheet_rows.append([
                            row_counter,
                            window_label,
                            timing_label,
                            date_label,
                            capacity,
                            0,
                            available,
                            "None",
                            "Unassigned / Open Slot",
                            "-",
                            "-",
                            "-",
                            "-",
                            "-",
                            "-",
                            "-",
                        ])
                        row_counter += 1
                    else:
                        for mid in assigned_ids:
                            reg = reg_by_id.get(mid)
                            p = (reg.get("participant") or {}) if reg else {}
                            slot_sheet_rows.append([
                                row_counter,
                                window_label,
                                timing_label,
                                date_label,
                                capacity,
                                assigned_count,
                                available,
                                mid,
                                p.get("name", mid),
                                p.get("college", ""),
                                p.get("department", ""),
                                p.get("year", ""),
                                p.get("email", ""),
                                p.get("phone", ""),
                                (reg.get("paymentStatus") or "").capitalize() if reg else "",
                                "YES" if (reg and reg.get("checkedIn")) else "NO",
                            ])
                            row_counter += 1

                all_sheets_payload[clean_slot_sheet_name] = slot_sheet_rows

            # Single atomic batch write for all sheets in 1 request!
            await self.batch_write_all_sheets(all_sheets_payload)

            _LAST_SYNC_STATUS["last_synced_at"] = datetime.now(timezone.utc).isoformat()
            _LAST_SYNC_STATUS["last_sync_type"] = "full_database"
            _LAST_SYNC_STATUS["last_error"] = None
            _LAST_SYNC_STATUS["total_sync_count"] += 1
            return True

        except Exception as err:
            logger.error(f"Full database sync error: {err}")
            _LAST_SYNC_STATUS["last_error"] = str(err)
            return False


google_sheets_service = GoogleSheetsService()
