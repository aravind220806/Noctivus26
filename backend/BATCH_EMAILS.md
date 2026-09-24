# Boarding pass batch delivery

Deploy the backend and frontend together. Restart the backend so startup creates the `invitation_jobs` SQLite table and starts the dispatch worker. Use the existing persistent SQLite volume shared by the API processes.

Automatic delivery is enabled by default (`INVITATION_AUTO_SEND_ENABLED=true`). Every five seconds, an idle worker checks persisted verified payments and reserves up to 20 unattempted passes in one transaction. This includes the existing verified backlog, single verifications, bulk verifications, and payments verified while another batch is running. The next batch is picked up automatically until the backlog is cleared. The admin page may be closed.

`INVITATION_SEND_INTERVAL_SECONDS=1` spaces automatic delivery starts one second apart, while allowing up to the configured concurrency to finish rendering and sending. Set `INVITATION_AUTO_SEND_ENABLED=false` to stop automatic queue creation (already queued work continues). Automatic queue creation waits for SMTP credentials and Chromium availability; it never uses development email simulation. Failed or interrupted attempts remain for manual review/retry rather than being retried indefinitely. Payment status and trash status are checked again immediately before each send.

The Invitations page refreshes statistics every five seconds and discovers active jobs started by automation or another admin. Manual batches remain available as an override.

`POST /api/admin/invitations/send-batch` and `/resend-failed` now return HTTP 202 with a job ID, rather than holding a request open for the entire batch. The Invitations page polls `/api/admin/invitations/jobs/{jobId}` every two seconds and resumes tracking after a refresh in the same tab. These routes retain admin authentication, tab permissions and CSRF protection.

Set `INVITATION_SEND_CONCURRENCY=4` in the deployment environment for four concurrent render/send operations (previous default: two). An existing explicit value of two still overrides the new default. The supported range remains one to four; actual throughput depends on the SMTP provider and rendering capacity.

An atomic SQLite transaction allows only one active batch across API workers. Repeated start requests return the existing job. Sent registrations are skipped, failed-recipient retries only target failed registrations, and an individual recipient failure does not stop other sends. Queued jobs survive a restart. Running jobs interrupted by shutdown or a missing heartbeat are flagged for review, not automatically resent: SMTP cannot guarantee exactly-once delivery if a process dies after the provider accepts a message but before its result is saved. Review sent counts and provider logs before retrying interrupted work.

No SMTP credentials or renderer installation changes are included. Actual mail delivery requires the existing SMTP settings and Playwright Chromium installation.

The Invitations page also lists every member with searchable/filterable delivery status: Awaiting payment, Waiting, Queued, Sending, Done, Failed, or Interrupted. Sending and completion timestamps are persisted per member in the job record, so progress survives page refreshes. Done means the email service accepted the message; it does not indicate that the participant opened it. Interrupted deliveries are never shown as still sending indefinitely.
