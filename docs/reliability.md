# Reliability

Operational ideas to keep the SaaS working when one component is down.

## Webhook Ingestion + Idempotency

Goals:

- A webhook can be delivered more than once without duplicating state.
- Failures are captured with enough context to safely retry.

Approach:

- Write an immutable webhook event record keyed by provider event ID.
- Derive subscription state from events (or upsert the subscription doc with deterministic logic).
- Persist provider customer/subscription linkage so future webhooks resolve users by stable external IDs before email fallback.
- Keep all webhook handlers "at least once" safe.

## Failure Capture (Dead-Letter Queue)

When webhook processing fails (missing user, validation error, outage), write a failure record:

- event key
- error code/message
- payload hash
- retry count
- createdAt / lastAttemptAt

This is the operational inbox to replay failures with a controlled tool.

## Scheduled Reconciliation

Run a scheduled job that:

- fetches current billing state from the payment provider (if available)
- recomputes desired subscription/access state
- fixes drift if a webhook was missed

## Outbox Pattern for Discord Actions

Do not perform Discord API side effects inline with webhook processing.

Instead:

- write a "role sync job" record
- bot processes jobs and marks them done or failed

Benefits:

- isolates rate limits and transient Discord failures
- retries become simple and auditable

Implemented:

- Convex `roleSyncJobs` table stores pending/processing/completed/failed role actions.
- Bun worker in `Discord-Bot` claims jobs from Convex and ACKs success/failure with exponential backoff retries.
- Role targets are resolved from tier mapping (`basic` / `advanced` / `pro`) stored in Convex and editable from admin UI; inactive/unlinked users are converged by revoking all managed tier roles.
- Sell access policies map product/variant IDs to tier and billing mode (`recurring` vs `fixed_term`), and a scheduled Convex job expires fixed-term entitlements and triggers role revoke sync without waiting for new webhooks.

## Observability Basics

Minimum:

- structured logs for each webhook and job execution
- metrics for success/failure rate, latency, retry counts
- alerts on sustained failure rates or growing DLQ size
