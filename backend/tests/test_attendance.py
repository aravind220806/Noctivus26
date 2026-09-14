import io
import pytest
from openpyxl import load_workbook

from app.db.sqlite_db import sqlite_db
from app.events import EVENT_CATALOG
from app.services.admin_access_service import ADMIN_TABS
from app.services.export_service import export_attendance_to_excel, export_full_live_backup_excel, export_scheduler_to_excel
from app.services.registration_service import serialize_registration
from app.routes.admin_routes import (
    extract_event_members_with_attendance,
    find_registration_flexible,
    format_registration_for_attendance,
)


def test_admin_tabs_includes_attendance():
    assert "Attendance" in ADMIN_TABS


@pytest.mark.asyncio
async def test_find_registration_flexible_and_members_extraction():
    await sqlite_db.init()

    sample_reg = {
        "registrationId": "NOC26-TEST99",
        "qrToken": "test_qr_token_12345",
        "qrHash": "dummy_hash_value",
        "paymentStatus": "confirmed",
        "participant": {
            "name": "ALICE SMITH",
            "email": "alice@example.com",
            "phone": "9876543210",
            "college": "Velammal Engineering College",
            "department": "CSE",
            "year": "3",
            "rollNo": "22CS101",
        },
        "eventRegistrations": [
            {
                "eventId": "prompt-heist",
                "eventName": "Prompt Heist",
                "category": "tech",
                "teamSize": 2,
                "teamMembers": [
                    {"name": "BOB JONES", "rollNo": "22CS102"}
                ],
                "attendance": {
                    "attended": True,
                    "markedAt": "2026-09-26T10:30:00Z",
                    "markedBy": "coordinator@noctivus26.com",
                    "members": [
                        {"name": "ALICE SMITH", "rollNo": "22CS101", "role": "Team Leader", "isLeader": True, "present": True},
                        {"name": "BOB JONES", "rollNo": "22CS102", "role": "Team Member", "isLeader": False, "present": False},
                    ]
                }
            }
        ],
        "checkedIn": True,
    }

    await sqlite_db.upsert("registrations", "NOC26-TEST99", sample_reg)

    # 1. Test flexible lookup by ID
    found_by_id = await find_registration_flexible("NOC26-TEST99")
    assert found_by_id is not None
    assert found_by_id["registrationId"] == "NOC26-TEST99"

    # 2. Test flexible lookup by QR token / URL
    found_by_url = await find_registration_flexible("https://noctivus26.com/p/test_qr_token_12345")
    assert found_by_url is not None
    assert found_by_url["registrationId"] == "NOC26-TEST99"

    # 3. Test flexible lookup by email
    found_by_email = await find_registration_flexible("alice@example.com")
    assert found_by_email is not None
    assert found_by_email["registrationId"] == "NOC26-TEST99"

    # 4. Test members extraction
    members = extract_event_members_with_attendance(sample_reg, "prompt-heist")
    assert len(members) == 2
    leader = next((m for m in members if m["isLeader"]), None)
    assert leader is not None
    assert leader["name"] == "ALICE SMITH"
    assert leader["present"] is True

    teammate = next((m for m in members if not m["isLeader"]), None)
    assert teammate is not None
    assert teammate["name"] == "BOB JONES"
    assert teammate["present"] is False

    # 5. Test formatted representation
    formatted = format_registration_for_attendance(sample_reg)
    assert "eventAttendanceList" in formatted
    ev_info = formatted["eventAttendanceList"][0]
    assert ev_info["eventId"] == "prompt-heist"
    assert ev_info["presentCount"] == 1
    assert ev_info["totalCount"] == 2
    assert ev_info["isPartial"] is True

    # Cleanup
    await sqlite_db.delete("registrations", "NOC26-TEST99")


def test_export_attendance_to_excel():
    sample_registrations = [
        {
            "registrationId": "NOC26-WIN01",
            "paymentStatus": "confirmed",
            "checkedIn": True,
            "participant": {
                "name": "SARAH CONNOR",
                "email": "sarah@cyber.io",
                "phone": "9998887776",
                "college": "Tech Institute of Chennai",
                "department": "IT",
                "year": "4",
                "rollNo": "IT401",
            },
            "eventRegistrations": [
                {
                    "eventId": "ctf",
                    "eventName": "NULL CORE 2.0 CTF",
                    "category": "tech",
                    "teamSize": 3,
                    "teamMembers": [
                        {"name": "JOHN CONNOR", "rollNo": "IT402"},
                        {"name": "KYLE REESE", "rollNo": "IT403"},
                    ],
                    "attendance": {
                        "attended": True,
                        "markedAt": "2026-09-26T10:15:00Z",
                        "markedBy": "ctf_coord@noctivus26.com",
                        "members": [
                            {"name": "SARAH CONNOR", "rollNo": "IT401", "role": "Team Leader", "isLeader": True, "present": True},
                            {"name": "JOHN CONNOR", "rollNo": "IT402", "role": "Team Member", "isLeader": False, "present": True},
                            {"name": "KYLE REESE", "rollNo": "IT403", "role": "Team Member", "isLeader": False, "present": False},
                        ]
                    }
                }
            ]
        },
        {
            "registrationId": "NOC26-SOLO1",
            "paymentStatus": "confirmed",
            "checkedIn": True,
            "participant": {
                "name": "NEO ANDERSON",
                "email": "neo@matrix.io",
                "phone": "9112223334",
                "college": "Velammal Engineering College",
                "department": "CSE",
                "year": "3",
                "rollNo": "CS301",
            },
            "eventRegistrations": [
                {
                    "eventId": "bug-hunt",
                    "eventName": "Bug Hunt",
                    "category": "tech",
                    "teamSize": 1,
                    "teamMembers": [],
                    "attendance": {
                        "attended": True,
                        "markedAt": "2026-09-26T11:00:00Z",
                        "markedBy": "bughunt_coord@noctivus26.com",
                        "members": [
                            {"name": "NEO ANDERSON", "rollNo": "CS301", "role": "Team Leader", "isLeader": True, "present": True},
                        ]
                    }
                }
            ]
        }
    ]

    excel_bytes = export_attendance_to_excel(EVENT_CATALOG[:5], sample_registrations)
    assert isinstance(excel_bytes, bytes)
    assert len(excel_bytes) > 0

    wb = load_workbook(io.BytesIO(excel_bytes))
    sheet_names = wb.sheetnames

    # Check Master Attendance Summary
    assert "Attendance Summary" in sheet_names
    summary_ws = wb["Attendance Summary"]
    assert summary_ws.cell(row=1, column=1).value == "S.No"
    assert summary_ws.cell(row=1, column=3).value == "Event Name"

    # Check E-Cert Master List sheet
    assert "E-Cert Master List" in sheet_names
    ecert_ws = wb["E-Cert Master List"]
    assert ecert_ws.cell(row=1, column=3).value == "Member Full Name"

    # Verify present members in E-Cert master sheet
    present_names = [ecert_ws.cell(row=r, column=3).value for r in range(2, ecert_ws.max_row + 1)]
    assert "SARAH CONNOR" in present_names
    assert "JOHN CONNOR" in present_names
    assert "NEO ANDERSON" in present_names
    assert "KYLE REESE" not in present_names # KYLE was absent

    # Check that individual event sheets exist
    assert any("CTF" in name or "NULL" in name for name in sheet_names)
    assert any("Bug Hunt" in name for name in sheet_names)


def test_excel_exports_escape_formula_like_values():
    registrations = [
        {
            "registrationId": "NOC26-FORM01",
            "paymentStatus": "confirmed",
            "checkedIn": True,
            "participant": {
                "name": '=HYPERLINK("https://evil.example","click")',
                "email": "formula@example.com",
                "phone": "9998887776",
                "college": "+Malicious College",
                "foodPreference": "veg",
            },
            "eventRegistrations": [
                {
                    "eventId": "ctf",
                    "eventName": "NULL CORE 2.0 CTF",
                    "category": "tech",
                    "teamSize": 1,
                    "teamMembers": [],
                }
            ],
            "assigned_slots": ["slot1"],
        }
    ]
    slots = [{"id": "slot1", "event_id": "ctf", "window": "morning", "start_time": "10:00", "end_time": "11:00", "assigned_member_ids": ["NOC26-FORM01"]}]

    for excel_bytes in (
        export_attendance_to_excel(EVENT_CATALOG[:1], registrations),
        export_scheduler_to_excel(EVENT_CATALOG[:1], slots, registrations),
        export_full_live_backup_excel(EVENT_CATALOG[:1], registrations, slots),
    ):
        wb = load_workbook(io.BytesIO(excel_bytes), data_only=False)
        risky_cells = [
            (sheet.title, cell.coordinate, cell.value, cell.data_type)
            for sheet in wb.worksheets
            for row in sheet.iter_rows()
            for cell in row
            if isinstance(cell.value, str)
            and cell.value.lstrip().startswith(("=", "+", "-", "@"))
        ]
        assert risky_cells == []

        escaped_cells = [
            cell.value
            for sheet in wb.worksheets
            for row in sheet.iter_rows()
            for cell in row
            if isinstance(cell.value, str)
            and ("evil.example" in cell.value or "Malicious College" in cell.value)
        ]
        assert escaped_cells
        assert all(cell.startswith("'") for cell in escaped_cells)


def test_google_sheets_live_workbook_uses_clean_verified_event_attendance_flow():
    from app.services.google_sheets_service import GoogleSheetsService

    events = [
        {"id": "ideathon", "name": "Ideathon Challenge"},
        {"id": "bug-hunt", "name": "Bug Hunt"},
    ]
    registrations = [
        {
            "registrationId": "NOC26-PENDING",
            "paymentStatus": "pending",
            "participant": {
                "name": "Pending User",
                "email": "pending@example.com",
                "phone": "9000000001",
                "college": "Pending College",
            },
            "eventRegistrations": [{"eventId": "ideathon", "eventName": "Ideathon Challenge"}],
        },
        {
            "registrationId": "NOC26-VERIFIED",
            "paymentStatus": "confirmed",
            "expectedAmount": 150,
            "verifiedAt": "2026-09-26T09:00:00Z",
            "verifiedBy": "admin@example.com",
            "participant": {
                "name": "Verified Leader",
                "email": "verified@example.com",
                "phone": "9000000002",
                "college": "Verified College",
                "department": "CSE",
                "year": "3",
                "rollNo": "CSE301",
                "foodPreference": "Veg",
            },
            "eventRegistrations": [
                {
                    "eventId": "ideathon",
                    "eventName": "Ideathon Challenge",
                    "teamMembers": [{"name": "Team Mate", "rollNo": "CSE302"}],
                    "attendance": {
                        "markedAt": "2026-09-26T10:00:00Z",
                        "markedBy": "staff@example.com",
                        "members": [
                            {"name": "VERIFIED LEADER", "present": True},
                            {"name": "TEAM MATE", "present": False},
                        ],
                    },
                }
            ],
        },
    ]

    workbook = GoogleSheetsService().build_live_workbook(events, registrations)

    assert "Registered" in workbook
    assert "Verified" in workbook
    assert "Ideathon Challenge" in workbook
    assert "Attendance - Ideathon Challenge" in workbook
    assert "Master Event Slots" not in workbook
    assert "Food Distribution" not in workbook

    registered_ids = [row[1] for row in workbook["Registered"][1:]]
    verified_ids = [row[1] for row in workbook["Verified"][1:]]
    ideathon_ids = [row[1] for row in workbook["Ideathon Challenge"][1:]]
    attendance_names = [row[2] for row in workbook["Attendance - Ideathon Challenge"][1:]]

    assert registered_ids == ["NOC26-PENDING", "NOC26-VERIFIED"]
    assert verified_ids == ["NOC26-VERIFIED"]
    assert ideathon_ids == ["NOC26-VERIFIED"]
    assert attendance_names == ["Verified Leader", "Team Mate"]
    assert workbook["Attendance - Ideathon Challenge"][1][10] == "PRESENT"


@pytest.mark.asyncio
async def test_google_sheets_sync_reports_failed_batch_write(monkeypatch):
    from app.services.google_sheets_service import GoogleSheetsService, _LAST_SYNC_STATUS

    service = GoogleSheetsService()
    previous_error = _LAST_SYNC_STATUS.get("last_error")
    previous_sync_count = _LAST_SYNC_STATUS.get("total_sync_count", 0)

    async def failed_batch_write(_sheets_data):
        _LAST_SYNC_STATUS["last_error"] = "Google Sheets API error (403): sheet not shared"
        return False

    monkeypatch.setattr(GoogleSheetsService, "is_enabled", property(lambda _self: True))
    monkeypatch.setattr(service, "batch_write_all_sheets", failed_batch_write)

    try:
        success = await service.sync_full_database([], [], [])
        assert success is False
        assert _LAST_SYNC_STATUS["last_error"] == "Google Sheets API error (403): sheet not shared"
        assert _LAST_SYNC_STATUS["total_sync_count"] == previous_sync_count
    finally:
        _LAST_SYNC_STATUS["last_error"] = previous_error


@pytest.mark.parametrize("abstract_fields", [
    {"abstract": "FraudTrace project"},
    {"igniteTopic": "FraudTrace project"},
    {"participant": {"abstract": "FraudTrace project"}},
    {"participant": {"igniteTopic": "FraudTrace project"}},
    {"eventRegistrations": [
        {"eventId": "ignite", "abstract": "FraudTrace project"},
        {"eventId": "hunt"},
    ]},
])
def test_live_sheets_include_current_and_legacy_abstracts(abstract_fields):
    from app.services.google_sheets_service import GoogleSheetsService

    registration = {
        "registrationId": "NOC26-ABSTRACT",
        "paymentStatus": "confirmed",
        "eventRegistrations": [{"eventId": "ignite"}, {"eventId": "hunt"}],
        **abstract_fields,
    }
    events = [{"id": "ignite", "name": "IGNITE"}, {"id": "hunt", "name": "Mystery Hunt"}]
    service = GoogleSheetsService()
    workbook = service.build_live_workbook(events, [registration])
    for title in ("Registered", "Verified", "IGNITE", "Mystery Hunt"):
        headers, row = workbook[title]
        assert len(headers) == len(row)
        assert row[headers.index("Abstract")] == ("" if title == "Mystery Hunt" else "FraudTrace project")

    pending = service.build_live_workbook(events, [{**registration, "paymentStatus": "pending"}])
    assert pending["Registered"][1][-1] == "FraudTrace project"
    assert len(pending["Verified"]) == 1
    blank = service.build_live_workbook(events, [{"paymentStatus": "pending"}])
    assert blank["Registered"][1][-1] == ""
