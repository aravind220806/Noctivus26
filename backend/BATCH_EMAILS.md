# Boarding pass batch delivery

Deploy the backend and frontend together. Restart the backend so startup creates the `invitation_jobs` SQLite table and starts the dispatch worker. Use the existing persistent SQLite volume shared by the API processes.

`POST /api/admin/invitations/send-batch` and `/resend-failed` now return HTTP 202 with a job ID, rather than holding a request open for the entire batch. The Invitations page polls `/api/admin/invitations/jobs/{jobId}` every two seconds and resumes tracking after a refresh in the same tab. These routes retain admin authentication, tab permissions and CSRF protection.

Set `INVITATION_SEND_CONCURRENCY=4` in the deployment environment for four concurrent render/send operations (previous default: two). An existing explicit value of two still overrides the new default. The supported range remains one to four; actual throughput depends on the SMTP provider and rendering capacity.

An atomic SQLite transaction allows only one active batch across API workers. Repeated start requests return the existing job. Sent registrations are skipped, failed-recipient retries only target failed registrations, and an individual recipient failure does not stop other sends. Queued jobs survive a restart. Running jobs interrupted by shutdown or a missing heartbeat are flagged for review, not automatically resent: SMTP cannot guarantee exactly-once delivery if a process dies after the provider accepts a message but before its result is saved. Review sent counts and provider logs before retrying interrupted work.

No SMTP credentials or renderer installation changes are included. Actual mail delivery requires the existing SMTP settings and Playwright Chromium installation.
