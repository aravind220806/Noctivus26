from collections import defaultdict
from datetime import datetime, timezone

from app.db import mongo
from app.db.memory_store import memory_event_schedule
from app.services.registration_service import load_registrations, update_registration

SCHEDULE_ID = "noctivus-26"
DEFAULT_SCHEDULE = {
    "scheduleId": SCHEDULE_ID,
    "morning": {"time": "09:00 AM", "memberCount": None},
    "afternoon": {"time": "02:00 PM", "memberCount": None},
}


def _clean_slot(value, fallback):
    source = value if isinstance(value, dict) else {}
    member_count = source.get("memberCount")
    try:
        member_count = max(1, min(10000, int(member_count))) if member_count not in (None, "") else None
    except (TypeError, ValueError):
        member_count = None
    return {"time": str(source.get("time") or fallback["time"]).strip()[:60], "memberCount": member_count}


def normalize_schedule(value=None):
    source = value if isinstance(value, dict) else {}
    return {
        "scheduleId": SCHEDULE_ID,
        "morning": _clean_slot(source.get("morning"), DEFAULT_SCHEDULE["morning"]),
        "afternoon": _clean_slot(source.get("afternoon"), DEFAULT_SCHEDULE["afternoon"]),
    }


async def get_schedule():
    if mongo.mongo_ready():
        stored = await mongo.db.event_schedules.find_one({"scheduleId": SCHEDULE_ID}, {"_id": 0})
    else:
        stored = memory_event_schedule or None
    return normalize_schedule(stored)


async def save_schedule(value, updated_by):
    schedule = normalize_schedule(value)
    now = datetime.now(timezone.utc)
    record = {**schedule, "updatedAt": now, "updatedBy": updated_by}
    if mongo.mongo_ready():
        await mongo.db.event_schedules.update_one({"scheduleId": SCHEDULE_ID}, {"$set": record}, upsert=True)
    else:
        memory_event_schedule.clear()
        memory_event_schedule.update(record)
    return record


def _member_count(entry):
    return max(1, int(entry.get("teamSize") or 1))


def _lane_for_category(category):
    return "technical" if category == "Technical" else "nonTechnical"


async def assign_batches(schedule):
    registrations = await load_registrations({"status": "confirmed"})
    lanes = {"technical": {"members": 0, "registrations": 0, "batches": defaultdict(int)}, "nonTechnical": {"members": 0, "registrations": 0, "batches": defaultdict(int)}}
    ordered = sorted(registrations, key=lambda row: (row.get("createdAt") or row.get("registrationId") or ""))
    event_totals = defaultdict(int)
    event_info = {}
    for row in ordered:
        for item in row.get("eventRegistrations", []):
            event_id = str(item.get("eventId") or "unknown-event")
            event_totals[event_id] += _member_count(item)
            event_info[event_id] = {"eventId": event_id, "eventName": item.get("eventName") or event_id, "category": item.get("category") or ""}
    morning_targets = {}
    manual_morning = schedule["morning"].get("memberCount")
    manual_afternoon = schedule["afternoon"].get("memberCount")
    for event_id, total in event_totals.items():
        morning_targets[event_id] = manual_morning or max(0, total - manual_afternoon) if manual_afternoon and not manual_morning else manual_morning or (total + 1) // 2
    event_batches = defaultdict(lambda: {"morning": 0, "afternoon": 0})
    for registration in ordered:
        changed = False
        event_entries = []
        for entry in registration.get("eventRegistrations", []):
            lane_name = _lane_for_category(entry.get("category"))
            lane = lanes[lane_name]
            member_count = _member_count(entry)
            event_id = str(entry.get("eventId") or "unknown-event")
            morning_count = morning_targets[event_id]
            batch_number = 1 if event_batches[event_id]["morning"] < morning_count or event_batches[event_id]["morning"] == 0 else 2
            slot_name = "morning" if batch_number == 1 else "afternoon"
            assignment = {
                "batch": f"{event_id}-{slot_name}",
                "batchNumber": batch_number,
                "batchCategory": entry.get("category") or "",
                "batchSlot": slot_name,
                "batchTime": schedule[slot_name]["time"],
            }
            updated_entry = {**entry, **assignment}
            event_entries.append(updated_entry)
            lane["members"] += member_count
            lane["registrations"] += 1
            lane["batches"][slot_name] += member_count
            event_batches[event_id][slot_name] += member_count
            changed = changed or any(entry.get(key) != value for key, value in assignment.items())
        if changed:
            await update_registration(registration["registrationId"], {"eventRegistrations": event_entries})
    summary = {}
    for lane_name, lane in lanes.items():
        summary[lane_name] = {
            "members": lane["members"],
            "registrations": lane["registrations"],
            "batchCount": len(lane["batches"]),
            "batches": [{"batch": f"{lane_name}-{slot}", "members": members, "time": schedule[slot]["time"]} for slot, members in lane["batches"].items()],
        }
    events = []
    for event_id, info in event_info.items():
        events.append({**info, "members": event_totals[event_id], "morning": event_batches[event_id]["morning"], "afternoon": event_batches[event_id]["afternoon"], "morningTime": schedule["morning"]["time"], "afternoonTime": schedule["afternoon"]["time"]})
    summary["events"] = sorted(events, key=lambda item: item["eventName"])
    return summary


def scheduler_analysis(schedule, summary):
    lines = ["Event scheduler analysis", f"Morning: {schedule['morning']['time']}", f"Afternoon: {schedule['afternoon']['time']}", f"Technical: {summary['technical']['members']} members across {summary['technical']['batchCount']} batch(es).", f"Non-technical: {summary['nonTechnical']['members']} members across {summary['nonTechnical']['batchCount']} batch(es)."]
    for lane_name in ("technical", "nonTechnical"):
        batches = summary[lane_name]["batches"]
        if batches:
            lines.append(f"{lane_name.title()} batch plan: " + ", ".join(f"{item['batch']} ({item['members']} members at {item['time']})" for item in batches))
        else:
            lines.append(f"{lane_name.title()} batch plan: no confirmed members yet.")
    for event in summary.get("events", []):
        lines.append(f"{event['eventName']}: {event['members']} members total, morning {event['morning']} at {event['morningTime']}, afternoon {event['afternoon']} at {event['afternoonTime']}.")
    lines.append("Participants registered for both categories receive an independent assignment for each event, and pass generation uses that event's assigned time.")
    return "\n".join(lines)
