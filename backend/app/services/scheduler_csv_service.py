"""Read scheduling inputs from the admin registration CSV export."""
import csv
import re
from pathlib import Path

from app.events import EVENT_ALIASES, EVENT_CATALOG


def _event_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def read_scheduler_registrations(path: Path) -> list[dict]:
    names = {}
    events = {event['id']: event for event in EVENT_CATALOG}
    for event in EVENT_CATALOG:
        names[_event_key(event['id'])] = event['id']
        names[_event_key(event['name'])] = event['id']
    for alias, event_id in EVENT_ALIASES.items():
        names[_event_key(alias)] = event_id
    # Previous display name retained in older registration exports.
    names[_event_key('IPL Bidverse')] = 'ipl-bidverse'

    result = []
    seen = set()
    with path.open(newline='', encoding='utf-8-sig') as source:
        reader = csv.DictReader(source)
        required = {'Registration ID', 'Events', 'Status'}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError('CSV must include Registration ID, Events, and Status columns.')
        for line, row in enumerate(reader, 2):
            member_id = (row.get('Registration ID') or '').strip()
            if not member_id or member_id in seen:
                raise ValueError(f'CSV row {line}: missing or duplicate registration ID.')
            seen.add(member_id)
            selected = [name.strip() for name in (row.get('Events') or '').split(';') if name.strip()]
            if not selected or any(_event_key(name) not in names for name in selected):
                raise ValueError(f'CSV row {line}: missing or unknown event name.')
            event_ids = list(dict.fromkeys(names[_event_key(name)] for name in selected))
            if len(event_ids) > 2:
                raise ValueError(f'CSV row {line}: more than two events.')
            status = (row.get('Status') or '').strip().lower()
            if not status:
                raise ValueError(f'CSV row {line}: missing payment status.')
            result.append({
                'registrationId': member_id,
                'paymentStatus': status,
                'participant': {'name': row.get('Name') or '', 'college': row.get('College') or ''},
                'event_ids': event_ids,
                'eventRegistrations': [{'eventId': eid, 'eventName': events[eid]['name']} for eid in event_ids],
                'assigned_slots': [],
            })
    return result
