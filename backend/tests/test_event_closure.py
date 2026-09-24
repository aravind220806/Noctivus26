import asyncio
from unittest.mock import AsyncMock

import pytest
from app.services import registration_service as service
from app.services import event_service


@pytest.mark.parametrize('status,auto_close,expected', [
    ('closed', None, 'closed'),
    ('open', '2000-01-01T00:00:00Z', 'closed'),
    ('open', None, 'open'),
    ('coming-soon', None, 'opening-soon'),
])
def test_public_status(monkeypatch, status, auto_close, expected):
    monkeypatch.setattr(service.settings, 'registration_open', True)
    monkeypatch.setattr(service, 'list_events', AsyncMock(return_value=[{
        'id': 'ctf', 'status': status, 'autoCloseAt': auto_close,
    }]))
    result = asyncio.run(service.registration_status())
    assert result['events'][0]['status'] == expected


@pytest.mark.parametrize('status,auto_close', [
    ('closed', None), ('open', '2000-01-01T00:00:00Z'),
])
def test_closed_submission_rejected_before_storage(monkeypatch, status, auto_close):
    monkeypatch.setattr(service.settings, 'registration_open', True)
    monkeypatch.setattr(service, 'list_events', AsyncMock(return_value=[{
        'id': 'ctf', 'status': status, 'autoCloseAt': auto_close,
    }]))
    code, data = asyncio.run(service.create_registration({'events': [{'eventId': 'ctf'}]}))
    assert code == 403
    assert data['code'] == 'EVENT_CLOSED'
    assert data['eventIds'] == ['ctf']


def test_admin_close_and_reopen_reaches_public_status(monkeypatch):
    monkeypatch.setattr(service.settings, 'registration_open', True)
    monkeypatch.setattr(event_service.sqlite_db, 'ready', lambda: False)
    monkeypatch.setattr(event_service, 'memory_events', event_service._seed_events())

    async def exercise():
        for status in ('closed', 'open'):
            await event_service.update_event('ctf', {'status': status}, 'test-admin')
            result = await service.registration_status()
            assert next(event for event in result['events'] if event['id'] == 'ctf')['status'] == status
    asyncio.run(exercise())
