"""Run the production scheduler on a CSV in a disposable database.

Usage: python backend/scripts/schedule_from_csv.py INPUT.csv --output-dir OUTPUT
Exports stay local; this command does not import members into the application DB.
"""
import argparse
import asyncio
import csv
import json
import os
import sys
import tempfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


async def run(source: Path, output: Path) -> dict:
    # Imported only after main selects an isolated SQLite path.
    from app.db.sqlite_db import sqlite_db
    from app.services.event_service import list_events
    from app.services.export_service import export_scheduler_to_excel, _safe_csv_value
    from app.services.registration_service import load_registrations
    from app.services.scheduler_csv_service import read_scheduler_registrations
    from app.services.scheduler_service import repair_event_schedule, load_all_slots, slotsConflict

    inputs = read_scheduler_registrations(source)
    await sqlite_db.init()
    if not sqlite_db.ready():
        raise RuntimeError('Unable to initialize isolated scheduler database.')
    for reg in inputs:
        await sqlite_db.upsert('registrations', reg['registrationId'], reg)
    summary = await repair_event_schedule()
    registrations = await load_registrations({'status': 'confirmed'})
    slots = await load_all_slots()
    events = await list_events()
    by_id = {slot['id']: slot for slot in slots}
    event_names = {event['id']: event['name'] for event in events}
    counts = Counter(eid for reg in registrations for eid in reg['event_ids'])
    expected_members = {sid: set() for sid in by_id}
    issues = []
    for reg in registrations:
        assigned = [by_id[sid] for sid in reg['assigned_slots'] if sid in by_id]
        if sorted(slot['event_id'] for slot in assigned) != sorted(reg['event_ids']):
            issues.append({'registration_id': reg['registrationId'], 'reason': 'Missing or duplicate event assignment'})
        for index, left in enumerate(assigned):
            expected_members[left['id']].add(reg['registrationId'])
            for right in assigned[index + 1:]:
                if slotsConflict(left, right):
                    issues.append({'registration_id': reg['registrationId'], 'reason': 'Overlapping events'})
    for slot in slots:
        members = slot['assigned_member_ids']
        if set(members) != expected_members[slot['id']] or len(members) != len(set(members)):
            issues.append({'slot_id': slot['id'], 'reason': 'Inconsistent membership'})
        if len(members) > slot['capacity']:
            issues.append({'slot_id': slot['id'], 'reason': 'Capacity exceeded'})

    for event in events:
        event['total_registrations'] = counts[event['id']]
    report = {
        'input_rows': len(inputs), 'confirmed_registrations': len(registrations),
        'excluded_unconfirmed': len(inputs) - len(registrations),
        'event_assignments': sum(len(reg['assigned_slots']) for reg in registrations),
        'summary': summary, 'validation_issues': issues,
        'schedule': [{'event': event_names[s['event_id']], 'date': s['date'],
                      'start': s['start_time'], 'end': s['end_time'],
                      'members': len(s['assigned_member_ids'])} for s in slots],
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'schedule-report.json').write_text(json.dumps(report, indent=2) + '\n')
    (output / 'noctivus-schedule.xlsx').write_bytes(export_scheduler_to_excel(events, slots, registrations))
    with (output / 'member-assignments.csv').open('w', newline='', encoding='utf-8-sig') as target:
        writer = csv.writer(target)
        writer.writerow(['Registration ID', 'Name', 'Event', 'Date', 'Start', 'End'])
        for reg in sorted(registrations, key=lambda reg: reg['registrationId']):
            for sid in reg['assigned_slots']:
                slot = by_id[sid]
                writer.writerow([_safe_csv_value(value) for value in [
                    reg['registrationId'], reg['participant']['name'], event_names[slot['event_id']],
                    slot['date'], slot['start_time'], slot['end_time']]])
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='noctivus-scheduler-') as temp:
        os.environ['SQLITE_DB_PATH'] = str(Path(temp) / 'schedule.db')
        report = asyncio.run(run(args.csv, args.output_dir))
    print(json.dumps(report, indent=2))
    if report['validation_issues'] or report['summary']['unassigned_conflicts'] or report['summary']['unassigned_full']:
        raise SystemExit(2)


if __name__ == '__main__':
    main()
