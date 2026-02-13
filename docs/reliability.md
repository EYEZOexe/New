# Reliability ideas (beyond “webhooks as functions”)

This document captures operational ideas that keep the SaaS working when one component is down.

## 1) Webhooks as Appwrite Functions (done)

Payments should be processed independently of the web app uptime.

- Implementation: `functions/sellapp-webhook`
- Idempotency: `webhook_events.eventId` unique index
- Outcome: update `subscriptions` + manage `paid` team

## 2) Scheduled reconciliation (recommended next)

Create a **scheduled Appwrite Function** that runs every N hours and:

- Fetches orders/subscriptions from Sell.app API (if available)
- Recomputes desired state for each user:
  - subscription status
  - paid team membership
- Fixes drift if a webhook was missed

Why it helps:
- Handles provider downtime, temporary network failures, misconfigured webhooks
- Gives you a “self-healing” billing state

## 3) Dead-letter queue + alerting

When a webhook fails processing (e.g. missing user email, user not found, Appwrite outage), write a record to:

- `webhook_failures` collection (eventId, error, payloadHash, createdAt)

Then:
- notify admins (Discord channel via bot, email, etc.)

Why it helps:
- prevents silent revenue leakage
- gives you a clear operational “inbox” to action

## 4) Outbox pattern for Discord actions

Instead of having the webhook directly call Discord APIs:

- write a `role_sync_jobs` document (userId, action, status)
- bot processes jobs and marks complete

Why it helps:
- isolates Discord rate limits and transient failures
- retries become simple

## 5) Read model caching for dashboard

If the dashboard relies on multiple Appwrite queries:

- maintain a denormalized `dashboard_feed` collection
- update via bot/collector when new signals arrive

Why it helps:
- reduces query complexity
- improves perceived speed and stability
