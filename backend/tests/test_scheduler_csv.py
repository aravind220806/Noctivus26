import csv

import pytest

from app.services.scheduler_csv_service import read_scheduler_registrations


def write_csv(tmp_path, rows, headers=None):
    path = tmp_path / 'registrations.csv'
    with path.open('w', newline='', encoding='utf-8-sig') as target:
        writer = csv.writer(target)
        writer.writerow(headers or ['Registration ID', 'Events', 'Status'])
        writer.writerows(rows)
    return path


def test_reads_export_and_normalizes_old_event_names(tmp_path):
    path = write_csv(tmp_path, [['TEST-1', 'Secure X Vibe Coding; IPL Bidverse', 'Confirmed']])
    records = read_scheduler_registrations(path)
    assert records[0]['event_ids'] == ['secure-x-vibecode', 'ipl-bidverse']
    assert records[0]['paymentStatus'] == 'confirmed'
    assert records[0]['eventRegistrations'][1]['eventName'] == 'Auction Arena'


def test_preserves_nonconfirmed_status_for_scheduler_filtering(tmp_path):
    records = read_scheduler_registrations(write_csv(tmp_path, [['TEST-1', 'IGNITE', 'pending']]))
    assert records[0]['paymentStatus'] == 'pending'


@pytest.mark.parametrize('rows', [
    [['TEST-1', 'Not an event', 'confirmed']],
    [['TEST-1', '', 'confirmed']],
    [['', 'IGNITE', 'confirmed']],
    [['TEST-1', 'IGNITE', 'confirmed'], ['TEST-1', 'Bug Hunt', 'confirmed']],
    [['TEST-1', 'IGNITE; Bug Hunt; Tune Trap', 'confirmed']],
    [['TEST-1', 'IGNITE', '']],
])
def test_rejects_invalid_rows_instead_of_silently_losing_members(tmp_path, rows):
    with pytest.raises(ValueError, match='CSV row'):
        read_scheduler_registrations(write_csv(tmp_path, rows))


def test_requires_export_headers(tmp_path):
    with pytest.raises(ValueError, match='CSV must include'):
        read_scheduler_registrations(write_csv(tmp_path, [], headers=['Name', 'Email']))


def test_personal_contact_and_payment_fields_are_not_loaded(tmp_path):
    path = write_csv(tmp_path, [['TEST-1', 'IGNITE', 'confirmed', 'private@example.test', '1234567890', '123456789012']],
                     headers=['Registration ID', 'Events', 'Status', 'Email', 'Phone', 'UTR'])
    record = read_scheduler_registrations(path)[0]
    assert set(record['participant']) == {'name', 'college'}
    assert 'utrNumber' not in record
