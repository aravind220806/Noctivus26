import csv
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def _safe_csv_value(value):
    if not isinstance(value, str):
        return value
    if value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def _get_abstract(registration: dict, event_id: str | None = None) -> str:
    if not registration:
        return ""
    event_regs = registration.get("eventRegistrations") or []
    if event_id:
        for ev in event_regs:
            if ev.get("eventId") == event_id and ev.get("abstract"):
                return ev["abstract"]
    for ev in event_regs:
        if ev.get("abstract"):
            return ev["abstract"]
    participant = registration.get("participant") or {}
    return (
        registration.get("abstract")
        or registration.get("igniteTopic")
        or participant.get("abstract")
        or participant.get("igniteTopic")
        or ""
    )


def registrations_to_csv(registrations: list[dict], sponsor_safe: bool = False, event_id: str | None = None) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    if sponsor_safe:
        writer.writerow(["Name", "College", "Events", "Abstract / Topic"])
    else:
        writer.writerow([
            "Registration ID",
            "Name",
            "Email",
            "Phone",
            "College",
            "Food",
            "Events",
            "Abstract / Topic",
            "Status",
            "UTR",
            "Expected Amount",
            "Claimed Amount",
            "Checked In",
            "Checked In At",
            "Submitted At",
            "Verified At",
        ])
    for registration in registrations:
        participant = registration.get("participant") or {}
        abstract_val = _get_abstract(registration, event_id)
        values = [
            participant.get("name"),
            participant.get("college"),
            "; ".join(event.get("eventName", "") for event in registration.get("eventRegistrations", [])),
            abstract_val,
        ] if sponsor_safe else [
            registration.get("registrationId"),
            participant.get("name"),
            participant.get("email"),
            participant.get("phone"),
            participant.get("college"),
            participant.get("foodPreference"),
            "; ".join(event.get("eventName", "") for event in registration.get("eventRegistrations", [])),
            abstract_val,
            registration.get("paymentStatus"),
            registration.get("utrNumber"),
            registration.get("expectedAmount"),
            registration.get("claimedAmount"),
            registration.get("checkedIn", False),
            registration.get("checkedInAt"),
            registration.get("paymentSubmittedAt"),
            registration.get("verifiedAt"),
        ]
        writer.writerow(_safe_csv_value(value) for value in values)
    return output.getvalue()


def export_scheduler_to_excel(events: list[dict], slots: list[dict], registrations: list[dict]) -> bytes:
    wb = Workbook()
    
    # Define styles
    header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    morning_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    afternoon_fill = PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    reg_by_id = {
        (r.get("registrationId") or r.get("member_id")): r
        for r in registrations
    }

    # ================= SHEET 1: Master Slot Schedule =================
    ws1 = wb.active
    ws1.title = "Master Event Slots"

    headers1 = [
        "Event Name",
        "Category",
        "Window",
        "Date",
        "Start Time",
        "End Time",
        "Slot Timing",
        "Capacity",
        "Assigned Count",
        "Available",
        "Assigned Member IDs",
        "Assigned Member Names",
    ]
    ws1.append(headers1)

    for col_num, header in enumerate(headers1, 1):
        cell = ws1.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    events_map = {e["id"]: e for e in events}
    
    # Sort slots: by event name, then window (morning first), then start_time
    sorted_slots = sorted(
        slots,
        key=lambda s: (
            events_map.get(s.get("event_id"), {}).get("name", s.get("event_id", "")),
            0 if str(s.get("window")).lower() == "morning" else 1,
            s.get("start_time", ""),
        ),
    )

    for row_idx, slot in enumerate(sorted_slots, 2):
        ev = events_map.get(slot.get("event_id"), {})
        assigned_ids = slot.get("assigned_member_ids") or []
        assigned_count = len(assigned_ids)
        capacity = slot.get("capacity") or 30
        available = max(0, capacity - assigned_count)
        
        member_names = []
        for mid in assigned_ids:
            reg = reg_by_id.get(mid)
            if reg:
                pname = (reg.get("participant") or {}).get("name", mid)
                member_names.append(f"{pname} ({mid})")
            else:
                member_names.append(mid)

        window_label = "Morning" if str(slot.get("window")).lower() == "morning" else "Afternoon"
        slot_timing = f"{slot.get('start_time', '')} - {slot.get('end_time', '')}"

        row_data = [
            ev.get("name", slot.get("event_id")),
            ev.get("category", "tech"),
            window_label,
            slot.get("date", "2026-09-26"),
            slot.get("start_time", ""),
            slot.get("end_time", ""),
            slot_timing,
            capacity,
            assigned_count,
            available,
            ", ".join(assigned_ids) if assigned_ids else "None",
            "; ".join(member_names) if member_names else "None",
        ]
        ws1.append(row_data)

        # Apply cell borders and subtle window colors
        for col_idx in range(1, len(row_data) + 1):
            cell = ws1.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx == 3: # Window column
                cell.fill = morning_fill if window_label == "Morning" else afternoon_fill
                cell.alignment = Alignment(horizontal="center")
            elif col_idx in (4, 5, 6, 7, 8, 9, 10):
                cell.alignment = Alignment(horizontal="center")

    # ================= SHEET 2: Event Summary =================
    ws2 = wb.create_sheet(title="Event Summary")
    headers2 = [
        "Event ID",
        "Event Name",
        "Category",
        "Duration (Mins)",
        "Total Registrations",
        "Total Slots",
        "Morning Slots",
        "Afternoon Slots",
        "Total Capacity",
        "Total Assigned",
        "Utilization %",
    ]
    ws2.append(headers2)
    for col_num in range(1, len(headers2) + 1):
        cell = ws2.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    slots_by_ev = {}
    for s in slots:
        eid = s.get("event_id")
        if eid not in slots_by_ev:
            slots_by_ev[eid] = []
        slots_by_ev[eid].append(s)

    for row_idx, ev in enumerate(events, 2):
        eid = ev["id"]
        ev_slots = slots_by_ev.get(eid, [])
        morning_count = sum(1 for s in ev_slots if str(s.get("window")).lower() == "morning")
        afternoon_count = sum(1 for s in ev_slots if str(s.get("window")).lower() == "afternoon")
        total_capacity = sum(s.get("capacity", 30) for s in ev_slots)
        total_assigned = sum(len(s.get("assigned_member_ids", [])) for s in ev_slots)
        utilization = f"{(total_assigned / total_capacity * 100):.1f}%" if total_capacity > 0 else "0.0%"

        row_data = [
            eid,
            ev.get("name", eid),
            ev.get("category", "tech"),
            ev.get("duration_minutes", 90),
            ev.get("total_registrations", 0),
            len(ev_slots),
            morning_count,
            afternoon_count,
            total_capacity,
            total_assigned,
            utilization,
        ]
        ws2.append(row_data)
        for col_idx in range(1, len(row_data) + 1):
            cell = ws2.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            if col_idx in (4, 5, 6, 7, 8, 9, 10, 11):
                cell.alignment = Alignment(horizontal="center")

    # ================= SHEET 3: Member Allocations =================
    ws3 = wb.create_sheet(title="Member Allocations")
    headers3 = [
        "Registration ID",
        "Member Name",
        "Email",
        "College",
        "Registered Events",
        "Abstract / Topic",
        "Assigned Slot IDs",
        "Slot Details (Window & Timing)",
    ]
    ws3.append(headers3)
    for col_num in range(1, len(headers3) + 1):
        cell = ws3.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    slots_map = {s["id"]: s for s in slots}
    
    confirmed_regs = [r for r in registrations if r.get("paymentStatus") == "confirmed"]
    for row_idx, reg in enumerate(confirmed_regs, 2):
        participant = reg.get("participant") or {}
        assigned_slot_ids = reg.get("assigned_slots") or []
        
        slot_descriptions = []
        for sid in assigned_slot_ids:
            sl = slots_map.get(sid)
            if sl:
                ev_name = events_map.get(sl.get("event_id"), {}).get("name", sl.get("event_id"))
                win = "Morning" if sl.get("window") == "morning" else "Afternoon"
                slot_descriptions.append(f"{ev_name}: {win} ({sl.get('start_time')} - {sl.get('end_time')})")
            else:
                slot_descriptions.append(sid)

        event_names = [e.get("eventName") or e.get("eventId") for e in reg.get("eventRegistrations", [])]

        row_data = [
            reg.get("registrationId") or reg.get("member_id"),
            participant.get("name", ""),
            participant.get("email", ""),
            participant.get("college", ""),
            ", ".join(event_names),
            _get_abstract(reg),
            ", ".join(assigned_slot_ids) if assigned_slot_ids else "Unassigned",
            "; ".join(slot_descriptions) if slot_descriptions else "Unassigned",
        ]
        ws3.append(row_data)
        for col_idx in range(1, len(row_data) + 1):
            cell = ws3.cell(row=row_idx, column=col_idx)
            cell.border = thin_border

    # Auto-adjust column widths on all sheets
    for sheet in (ws1, ws2, ws3):
        for col in sheet.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            sheet.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
