"""Durable batch status with a single claimed runner across API workers."""
import asyncio
import json
import logging
import time
import uuid

import aiosqlite

from app.core.config import settings
from app.db import sqlite_db as storage
from app.services.email_service import send_member_pass
from app.services.audit_service import record_admin_action
from app.services.registration_service import load_registrations

logger = logging.getLogger(__name__)
STALE_SECONDS = 120


async def create_job(registrations, admin_email):
    if not storage.sqlite_db.ready():
        raise RuntimeError("Batch storage is unavailable.")
    async with aiosqlite.connect(storage.DB_PATH, timeout=15) as db:
        await db.execute("BEGIN IMMEDIATE")
        # All admins see the same active job; repeated submissions cannot duplicate it.
        async with db.execute("SELECT data FROM invitation_jobs WHERE json_extract(data, '$.status') IN ('queued','running') ORDER BY updated DESC LIMIT 1") as cur:
            row = await cur.fetchone()
        if row:
            return json.loads(row[0])
        job = {"jobId": uuid.uuid4().hex, "status": "queued", "registrationIds": [r['registrationId'] for r in registrations],
               "adminEmail": admin_email, "attempted": len(registrations), "succeeded": 0, "failed": 0,
               "successful": [], "failedList": [], "concurrency": settings.invitation_send_concurrency}
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

    async def save():
        await storage.sqlite_db.upsert('invitation_jobs', job['jobId'], job)

    async def heartbeat():
        while True:
            await asyncio.sleep(10)
            async with lock:
                await save()

    async def send(reg_id, rows):
        async with sem:
            reg = rows.get(reg_id)
            participant = (reg or {}).get('participant') or {}
            result = {'registrationId': reg_id, 'name': participant.get('name', ''), 'email': participant.get('email', '')}
            try:
                if not reg or reg.get('paymentStatus') != 'confirmed':
                    raise ValueError('Registration is no longer eligible.')
                if reg.get('pass_status') == 'sent':
                    result['success'] = True
                else:
                    result = await send_member_pass(reg, job['adminEmail'])
            except Exception:
                logger.exception('Pass dispatch failed for %s', reg_id)
                result.update(success=False, reason='Unable to complete dispatch. Review registration status before retrying.')
            async with lock:
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


async def invitation_worker():
    while True:
        try:
            if storage.sqlite_db.ready():
                job = await claim_job()
                if job:
                    await run_job(job)
                    continue
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception('Invitation worker error')
        await asyncio.sleep(1)
