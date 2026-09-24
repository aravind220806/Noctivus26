"""Durable batch status with a single claimed runner across API workers."""
import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone

import aiosqlite

from app.core.config import settings
from app.db import sqlite_db as storage
from app.services.email_service import send_member_pass
from app.services.audit_service import record_admin_action
from app.services.registration_service import load_registrations, is_trashed
from app.services.browser_renderer import renderer_available

logger = logging.getLogger(__name__)
STALE_SECONDS = 120


async def create_job(registrations, admin_email, *, automatic=False):
    if not storage.sqlite_db.ready():
        raise RuntimeError("Batch storage is unavailable.")
    async with aiosqlite.connect(storage.DB_PATH, timeout=15) as db:
        await db.execute("BEGIN IMMEDIATE")
        # All admins see the same active job; repeated submissions cannot duplicate it.
        async with db.execute("SELECT data FROM invitation_jobs WHERE json_extract(data, '$.status') IN ('queued','running') ORDER BY updated DESC LIMIT 1") as cur:
            row = await cur.fetchone()
        if row:
            return json.loads(row[0])
        if automatic:
            # Select and reserve the backlog in the same transaction as job creation.
            # Previously attempted/uncertain deliveries require an explicit retry.
            async with db.execute("""
                SELECT r.data FROM registrations r
                WHERE json_extract(r.data, '$.paymentStatus') = 'confirmed'
                  AND COALESCE(json_extract(r.data, '$.pass_status'), 'not_sent') = 'not_sent'
                  AND COALESCE(json_extract(r.data, '$.trashedAt'), '') = ''
                  AND NOT EXISTS (
                    SELECT 1 FROM invitation_jobs j, json_each(j.data, '$.registrationIds') ids
                    WHERE ids.value = r.key
                  )
                ORDER BY r.updated ASC LIMIT 20
            """) as cur:
                registrations = [json.loads(row[0]) for row in await cur.fetchall()]
            if not registrations:
                return None
        registration_ids = [r['registrationId'] for r in registrations]
        job = {"automatic": automatic, "jobId": uuid.uuid4().hex, "status": "queued", "registrationIds": registration_ids,
               "adminEmail": admin_email, "attempted": len(registrations), "succeeded": 0, "failed": 0,
               "successful": [], "failedList": [], "memberStates": {
                   registration_id: {'status': 'queued', 'startedAt': None, 'completedAt': None, 'reason': ''}
                   for registration_id in registration_ids
               }, "concurrency": settings.invitation_send_concurrency}
        await db.execute("INSERT INTO invitation_jobs(key,data,updated) VALUES(?,?,?)", (job['jobId'], json.dumps(job), time.time()))
        await db.commit()
        return job


def public_job(job):
    return {key: value for key, value in job.items() if key not in {'registrationIds', 'adminEmail'}}


async def get_job(job_id):
    return await storage.sqlite_db.get('invitation_jobs', job_id)


async def claim_job():
    async with aiosqlite.connect(storage.DB_PATH, timeout=15) as db:
        await db.execute('BEGIN IMMEDIATE')
        async with db.execute("SELECT key,data,updated FROM invitation_jobs WHERE json_extract(data, '$.status') IN ('queued','running') ORDER BY updated ASC") as cur:
            rows = await cur.fetchall()
        for key, raw, updated in rows:
            job = json.loads(raw)
            if job['status'] == 'running':
                if time.time() - updated > STALE_SECONDS:
                    job['status'] = 'interrupted'
                    job['message'] = 'Sending was interrupted. Review sent counts before starting another batch; delivery of unfinished items may be uncertain.'
                    await db.execute('UPDATE invitation_jobs SET data=?,updated=? WHERE key=?', (json.dumps(job), time.time(), key))
                continue
            job['status'] = 'running'
            await db.execute('UPDATE invitation_jobs SET data=?,updated=? WHERE key=?', (json.dumps(job), time.time(), key))
            await db.commit()
            return job
        await db.commit()
    return None


async def run_job(job):
    lock = asyncio.Lock()
    sem = asyncio.Semaphore(settings.invitation_send_concurrency)
    pace_lock = asyncio.Lock()
    next_start = 0.0

    async def save():
        await storage.sqlite_db.upsert('invitation_jobs', job['jobId'], job)

    async def heartbeat():
        while True:
            await asyncio.sleep(10)
            async with lock:
                await save()

    async def send(reg_id, rows):
        nonlocal next_start
        async with sem:
            if job.get('automatic'):
                async with pace_lock:
                    await asyncio.sleep(max(0, next_start - time.monotonic()))
                    next_start = time.monotonic() + settings.invitation_send_interval_seconds
            # Recheck eligibility just before delivery, including payment reversals.
            reg = await storage.sqlite_db.get('registrations', reg_id) if storage.sqlite_db.ready() else rows.get(reg_id)
            participant = (reg or {}).get('participant') or {}
            result = {'registrationId': reg_id, 'name': participant.get('name', ''), 'email': participant.get('email', '')}
            try:
                if not reg or is_trashed(reg) or reg.get('paymentStatus') != 'confirmed':
                    raise ValueError('Registration is no longer eligible.')
                if reg.get('pass_status') == 'sent':
                    result['success'] = True
                else:
                    async with lock:
                        job.setdefault('memberStates', {})[reg_id] = {
                            'status': 'sending', 'startedAt': datetime.now(timezone.utc).isoformat(),
                        }
                        await save()
                    result = await send_member_pass(reg, job['adminEmail'])
            except Exception:
                logger.exception('Pass dispatch failed for %s', reg_id)
                result.update(success=False, reason='Unable to complete dispatch. Review registration status before retrying.')
            async with lock:
                member = job.setdefault('memberStates', {}).setdefault(reg_id, {})
                member.update(status='done' if result.get('success') else 'failed',
                              completedAt=datetime.now(timezone.utc).isoformat(),
                              reason=result.get('reason', ''))
                if result.get('success'):
                    job['successful'].append({k: result.get(k, '') for k in ['registrationId', 'name', 'email']})
                    job['succeeded'] += 1
                else:
                    job['failedList'].append({k: result.get(k, '') for k in ['registrationId', 'name', 'email', 'reason']})
                    job['failed'] += 1
                await save()

    pulse = asyncio.create_task(heartbeat())
    try:
        rows = {r['registrationId']: r for r in await load_registrations()}
        # TaskGroup cancels outstanding sends if persisting a result fails.
        async with asyncio.TaskGroup() as group:
            for reg_id in job['registrationIds']:
                group.create_task(send(reg_id, rows))
        job['status'] = 'completed'
    except asyncio.CancelledError:
        job['status'] = 'interrupted'
        job['message'] = 'Server restarted during dispatch. Review sent counts before retrying.'
        raise
    except Exception:
        logger.exception('Invitation batch interrupted')
        job['status'] = 'interrupted'
        job['message'] = 'Batch interrupted. Review sent counts before retrying.'
    finally:
        pulse.cancel()
        await asyncio.gather(pulse, return_exceptions=True)
        await save()
        await record_admin_action(job['adminEmail'], 'invitation.batch_send', job['jobId'], {k: job[k] for k in ['attempted', 'succeeded', 'failed', 'status']})


async def member_delivery_statuses(registrations):
    """Resolve the latest durable job status for every non-trashed member."""
    history = await storage.sqlite_db.list_all('invitation_jobs', order='desc')
    latest = {}
    for job in history:
        for reg_id in job.get('registrationIds', []):
            latest.setdefault(reg_id, job)
    members = []
    for reg in registrations:
        reg_id = reg['registrationId']
        participant = reg.get('participant') or {}
        job = latest.get(reg_id) or {}
        state = (job.get('memberStates') or {}).get(reg_id) or {}
        completed = next((r for r in job.get('successful', []) if r['registrationId'] == reg_id), None)
        failure = next((r for r in job.get('failedList', []) if r['registrationId'] == reg_id), None)
        active = job.get('status') in ('queued', 'running')
        status = 'waiting'
        reason = ''
        if reg.get('pass_status') == 'sent' or completed or state.get('status') == 'done':
            status = 'done'
        elif failure or state.get('status') == 'failed':
            status = 'failed'
            reason = state.get('reason') or (failure or {}).get('reason') or ''
        elif job and not active:
            status = 'interrupted'
            reason = 'Delivery was interrupted. Review before retrying.'
        elif reg.get('paymentStatus') != 'confirmed':
            status = 'awaiting_payment'
        elif active:
            status = 'sending' if state.get('status') == 'sending' else 'queued'
        elif reg.get('pass_status') == 'failed':
            status = 'failed'
            reason = reg.get('pass_failure_reason') or ''
        members.append({
            'registrationId': reg_id, 'name': participant.get('name') or 'Member',
            'email': participant.get('email') or '', 'status': status, 'reason': reason,
            'startedAt': state.get('startedAt'),
            'completedAt': state.get('completedAt') or reg.get('pass_sent_at') or reg.get('pass_failed_at'),
        })
    return members


async def automation_status():
    latest = None
    if storage.sqlite_db.ready():
        async with aiosqlite.connect(storage.DB_PATH) as db:
            async with db.execute("SELECT data FROM invitation_jobs ORDER BY (json_extract(data, '$.status') IN ('queued','running')) DESC, updated DESC LIMIT 1") as cur:
                row = await cur.fetchone()
                latest = json.loads(row[0]) if row else None

    return {
        'enabled': settings.invitation_auto_send_enabled,
        'emailConfigured': bool(settings.smtp_password),
        'intervalSeconds': settings.invitation_send_interval_seconds,
        'latestJob': public_job(latest) if latest else None,
    }


async def queue_automatic_passes():
    if not settings.invitation_auto_send_enabled or not settings.smtp_password:
        return None
    if not await renderer_available():
        return None
    return await create_job([], 'automation', automatic=True)


async def invitation_worker():
    next_scan = 0.0
    while True:
        try:
            if storage.sqlite_db.ready():
                job = await claim_job()
                if not job and time.monotonic() >= next_scan:
                    await queue_automatic_passes()
                    next_scan = time.monotonic() + 5
                    job = await claim_job()
                if job:
                    await run_job(job)
                    continue
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception('Invitation worker error')
        await asyncio.sleep(1)
