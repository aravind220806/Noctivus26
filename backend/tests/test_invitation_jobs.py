import asyncio
import json
import time
from unittest.mock import AsyncMock

import aiosqlite
import pytest
import pytest_asyncio

from app.db import sqlite_db as storage
from app.services import invitation_job_service as jobs


@pytest_asyncio.fixture
async def job_db(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path / 'jobs.db')
    monkeypatch.setattr(storage.sqlite_db, '_ready', False)
    await storage.sqlite_db.init()
    monkeypatch.setattr(jobs, 'record_admin_action', AsyncMock())


def registrations(count):
    return [{'registrationId': f'NOC26-{n}', 'paymentStatus': 'confirmed', 'participant': {'name': 'Test', 'email': 'test@example.com'}} for n in range(count)]


@pytest.mark.asyncio
async def test_atomic_submission_and_claim(job_db):
    first, second = await asyncio.gather(jobs.create_job(registrations(6), 'a'), jobs.create_job(registrations(6), 'b'))
    assert first['jobId'] == second['jobId']
    assert first['status'] == 'queued'
    claims = await asyncio.gather(jobs.claim_job(), jobs.claim_job())
    assert sum(c is not None for c in claims) == 1
    assert 'adminEmail' not in jobs.public_job(first)
    assert 'registrationIds' not in jobs.public_job(first)


@pytest.mark.asyncio
async def test_parallel_progress_and_failure_isolation(job_db, monkeypatch):
    rows = registrations(8)
    monkeypatch.setattr(jobs, 'load_registrations', AsyncMock(return_value=rows))
    monkeypatch.setattr(jobs.settings, 'invitation_send_concurrency', 4)
    active = peak = 0
    async def send(reg, admin):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(.02)
        active -= 1
        if reg['registrationId'] == 'NOC26-0':
            raise RuntimeError('one recipient failed')
        return {'success': True, 'registrationId': reg['registrationId'], 'name': 'Test', 'email': 'test@example.com'}
    monkeypatch.setattr(jobs, 'send_member_pass', send)
    job = await jobs.create_job(rows, 'admin')
    await jobs.run_job(await jobs.claim_job())
    result = await jobs.get_job(job['jobId'])
    assert peak == 4
    assert result['status'] == 'completed'
    assert result['succeeded'] == 7 and result['failed'] == 1


@pytest.mark.asyncio
async def test_stale_job_is_not_automatically_resent(job_db):
    job = await jobs.create_job(registrations(2), 'admin')
    await jobs.claim_job()
    async with aiosqlite.connect(storage.DB_PATH) as db:
        await db.execute('UPDATE invitation_jobs SET updated=?', (time.time() - jobs.STALE_SECONDS - 1,))
        await db.commit()
    assert await jobs.claim_job() is None
    assert (await jobs.get_job(job['jobId']))['status'] == 'interrupted'


@pytest.mark.asyncio
async def test_sent_recipient_is_not_resent(job_db, monkeypatch):
    rows = registrations(1)
    rows[0]['pass_status'] = 'sent'
    monkeypatch.setattr(jobs, 'load_registrations', AsyncMock(return_value=rows))
    sender = AsyncMock()
    monkeypatch.setattr(jobs, 'send_member_pass', sender)
    await jobs.create_job(rows, 'admin')
    await jobs.run_job(await jobs.claim_job())
    sender.assert_not_awaited()


def test_api_queues_and_worker_completes(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.middleware.admin_auth import sign_admin_token
    from app.routes import admin_routes
    import app.middleware.admin_auth as auth
    import app.main as main

    monkeypatch.setattr(storage, 'DB_PATH', tmp_path / 'integration.db')
    monkeypatch.setattr(storage.sqlite_db, '_ready', False)
    monkeypatch.setattr(main, 'email_worker', AsyncMock())
    monkeypatch.setattr(auth, 'resolve_admin_access', AsyncMock(return_value={'tabs': ['Invitations'], 'owner': True}))
    monkeypatch.setattr(auth, 'session_exists', AsyncMock(return_value=True))
    monkeypatch.setattr(admin_routes, 'renderer_available', AsyncMock(return_value=True))
    rows = registrations(3)
    monkeypatch.setattr(admin_routes, 'load_registrations', AsyncMock(return_value=rows))
    monkeypatch.setattr(jobs, 'load_registrations', AsyncMock(return_value=rows))
    async def send(reg, admin):
        return {'success': True, 'registrationId': reg['registrationId'], 'name': 'Test', 'email': 'test@example.com'}
    monkeypatch.setattr(jobs, 'send_member_pass', send)
    token, csrf = sign_admin_token({'email': 'admin@example.com', 'name': 'Admin', 'tabs': ['Invitations'], 'owner': True})
    with TestClient(app) as client:
        client.cookies.set('noctivus_admin_session', token)
        response = client.post('/api/admin/invitations/send-batch', json={'batchSize': 3}, headers={'X-CSRF-Token': csrf, 'Origin': 'http://localhost:5173'})
        assert response.status_code == 202
        job_id = response.json()['jobId']
        for _ in range(60):
            progress = client.get(f'/api/admin/invitations/jobs/{job_id}')
            assert progress.status_code == 200
            if progress.json()['status'] == 'completed':
                break
            time.sleep(.05)
        assert progress.json()['status'] == 'completed'
        assert progress.json()['succeeded'] == 3
        assert progress.headers['cache-control'] == 'no-store'
        client.cookies.clear()
        assert client.get(f'/api/admin/invitations/jobs/{job_id}').status_code == 401
