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
    monkeypatch.setattr(jobs.settings, 'invitation_auto_send_enabled', False)


def registrations(count):
    return [{'registrationId': f'NOC26-{n}', 'paymentStatus': 'confirmed', 'participant': {'name': 'Test', 'email': 'test@example.com'}} for n in range(count)]


@pytest.mark.asyncio
async def test_atomic_submission_and_claim(job_db):
    first, second = await asyncio.gather(jobs.create_job(registrations(6), 'a'), jobs.create_job(registrations(6), 'b'))
    assert first['jobId'] == second['jobId']
    assert first['status'] == 'queued'
    assert {state['status'] for state in first['memberStates'].values()} == {'queued'}
    assert len(first['memberStates']) == 6
    claims = await asyncio.gather(jobs.claim_job(), jobs.claim_job())
    assert sum(c is not None for c in claims) == 1
    assert 'adminEmail' not in jobs.public_job(first)
    assert 'registrationIds' not in jobs.public_job(first)


@pytest.mark.asyncio
async def test_parallel_progress_and_failure_isolation(job_db, monkeypatch):
    rows = registrations(8)
    for row in rows:
        await storage.sqlite_db.upsert('registrations', row['registrationId'], row)
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
    for row in rows:
        await storage.sqlite_db.upsert('registrations', row['registrationId'], row)
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
    monkeypatch.setattr(jobs.settings, 'invitation_auto_send_enabled', False)
    original_get = storage.sqlite_db.get
    async def fake_get(table, key):
        if table == 'registrations':
            return next((r for r in rows if r['registrationId'] == key), None)
        return await original_get(table, key)
    monkeypatch.setattr(storage.sqlite_db, 'get', fake_get)
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


@pytest.mark.asyncio
async def test_automatic_backlog_and_payment_verification(job_db):
    from app.services.registration_service import update_registration
    rows = registrations(5)
    rows[0]['paymentStatus'] = 'registered'
    rows[1]['pass_status'] = 'sent'
    rows[2]['pass_status'] = 'failed'
    rows[3]['trashedAt'] = '2026-09-24T00:00:00Z'
    for row in rows:
        await storage.sqlite_db.upsert('registrations', row['registrationId'], row)
    first = await jobs.create_job([], 'automation', automatic=True)
    assert first['registrationIds'] == ['NOC26-4']
    await update_registration('NOC26-0', {'paymentStatus': 'confirmed'})
    # Verification during another batch is retained for the next scan.
    assert (await jobs.create_job([], 'automation', automatic=True))['jobId'] == first['jobId']
    first['status'] = 'completed'
    await storage.sqlite_db.upsert('invitation_jobs', first['jobId'], first)
    second = await jobs.create_job([], 'automation', automatic=True)
    assert second['registrationIds'] == ['NOC26-0']
    second['status'] = 'interrupted'
    await storage.sqlite_db.upsert('invitation_jobs', second['jobId'], second)
    assert await jobs.create_job([], 'automation', automatic=True) is None


@pytest.mark.asyncio
async def test_automatic_pacing_and_fresh_payment_check(job_db, monkeypatch):
    rows = registrations(4)
    for row in rows:
        await storage.sqlite_db.upsert('registrations', row['registrationId'], row)
    job = await jobs.create_job([], 'automation', automatic=True)
    rows[1]['paymentStatus'] = 'mismatch'
    await storage.sqlite_db.upsert('registrations', rows[1]['registrationId'], rows[1])
    monkeypatch.setattr(jobs.settings, 'invitation_send_interval_seconds', .03)
    starts = []
    async def send(reg, admin):
        starts.append(time.monotonic())
        assert reg['paymentStatus'] == 'confirmed'
        return {'success': True, 'registrationId': reg['registrationId'], 'name': 'Test', 'email': 'test@example.com'}
    monkeypatch.setattr(jobs, 'send_member_pass', send)
    await jobs.run_job(await jobs.claim_job())
    result = await jobs.get_job(job['jobId'])
    assert result['succeeded'] == 3 and result['failed'] == 1
    assert all(b - a >= .025 for a, b in zip(starts, starts[1:]))


@pytest.mark.asyncio
async def test_automatic_dispatch_requires_live_email_and_renderer(job_db, monkeypatch):
    renderer = AsyncMock(return_value=True)
    monkeypatch.setattr(jobs, 'renderer_available', renderer)
    monkeypatch.setattr(jobs.settings, 'smtp_password', 'test-only')
    assert await jobs.queue_automatic_passes() is None
    renderer.assert_not_awaited()
    monkeypatch.setattr(jobs.settings, 'invitation_auto_send_enabled', True)
    monkeypatch.setattr(jobs.settings, 'smtp_password', '')
    assert await jobs.queue_automatic_passes() is None
    renderer.assert_not_awaited()
    monkeypatch.setattr(jobs.settings, 'smtp_password', 'test-only')
    renderer.return_value = False
    assert await jobs.queue_automatic_passes() is None
    row = registrations(1)[0]
    await storage.sqlite_db.upsert('registrations', row['registrationId'], row)
    renderer.return_value = True
    queued = await jobs.queue_automatic_passes()
    assert queued['automatic'] is True
    assert queued['registrationIds'] == [row['registrationId']]
    status = await jobs.automation_status()
    assert status['enabled'] is True
    assert status['latestJob']['jobId'] == queued['jobId']


@pytest.mark.asyncio
async def test_automatic_backlog_is_bounded_and_atomic(job_db):
    for row in registrations(25):
        await storage.sqlite_db.upsert('registrations', row['registrationId'], row)
    first, second = await asyncio.gather(jobs.create_job([], 'automation', automatic=True), jobs.create_job([], 'automation', automatic=True))
    assert first['jobId'] == second['jobId']
    assert first['attempted'] == 20


@pytest.mark.asyncio
async def test_member_status_lifecycle(job_db, monkeypatch):
    rows = registrations(3)
    rows[2]['paymentStatus'] = 'registered'
    for row in rows:
        await storage.sqlite_db.upsert('registrations', row['registrationId'], row)
    before = await jobs.member_delivery_statuses(rows)
    assert [m['status'] for m in before] == ['waiting', 'waiting', 'awaiting_payment']
    await jobs.create_job(rows[:2], 'admin')
    queued = await jobs.member_delivery_statuses(rows)
    assert [m['status'] for m in queued] == ['queued', 'queued', 'awaiting_payment']
    async def send(reg, admin):
        statuses = await jobs.member_delivery_statuses(rows)
        member = next(m for m in statuses if m['registrationId'] == reg['registrationId'])
        assert member['status'] == 'sending'
        assert member['startedAt']
        return {'success': reg['registrationId'] == 'NOC26-0', 'registrationId': reg['registrationId'], 'name': 'Test', 'email': 'test@example.com', 'reason': 'Mailbox unavailable'}
    monkeypatch.setattr(jobs, 'send_member_pass', send)
    await jobs.run_job(await jobs.claim_job())
    finished = await jobs.member_delivery_statuses(rows)
    assert [m['status'] for m in finished] == ['done', 'failed', 'awaiting_payment']
    assert finished[0]['startedAt'] and finished[0]['completedAt']
    assert finished[1]['reason'] == 'Mailbox unavailable'


@pytest.mark.asyncio
async def test_interrupted_member_does_not_remain_sending(job_db):
    rows = registrations(1)
    job = await jobs.create_job(rows, 'admin')
    job.update(status='interrupted', memberStates={'NOC26-0': {'status': 'sending', 'startedAt': '2026-09-24T08:00:00Z'}})
    await storage.sqlite_db.upsert('invitation_jobs', job['jobId'], job)
    statuses = await jobs.member_delivery_statuses(rows)
    assert statuses[0]['status'] == 'interrupted'
    rows[0]['pass_status'] = 'sent'
    assert (await jobs.member_delivery_statuses(rows))[0]['status'] == 'done'
