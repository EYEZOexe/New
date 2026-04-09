# Reliability

Operational reliability guide for G3n S1gnals on Next.js, Convex, Clerk, and Stripe.

This document defines the reliability rules for authentication-linked state, billing, entitlements, signal ingestion, and downstream delivery. These are not optional improvements. They are baseline architecture constraints for a system that must handle concurrent users, duplicate events, retries, and partial outages safely.

## Reliability Goals

- no duplicate access grants from duplicate Stripe events
- no lost access revocations when billing state changes
- no duplicate canonical signals from repeated upstream payloads
- no blocking third-party side effects on hot write paths
- no silent failures without an audit trail, retry path, or operator visibility
- no hot-path queries that degrade sharply as data volume grows

## System of Record

Use the following boundaries consistently:

- Clerk is the system of record for identity and session authentication
- Stripe is the system of record for billing events and subscription lifecycle
- Convex is the system of record for application state, entitlements, signals, jobs, and read models

Implication:

- never trust frontend redirects as proof of payment
- never trust client-provided user identifiers for authorization
- never compute long-lived access from transient UI state

## Reliability Principles

- idempotency first
- append-only event capture where replay matters
- outbox and job queues for side effects
- bounded queries on all hot paths
- deterministic state transitions
- explicit retry and dead-letter handling
- reconciliation jobs for missed or delayed third-party events
- structured logs and metrics for every critical workflow

## Critical Flows

### 1. Identity Bootstrap

Goal:

- create or update the Convex user projection safely whenever a Clerk-authenticated user enters the app

Rules:

- key user linkage from Clerk identity using the server-resolved token identity
- make bootstrap idempotent so repeated sign-ins do not create duplicate profiles
- keep Clerk-derived data minimal: only store what the app needs
- separate authentication state from membership and role state

Failure handling:

- if profile projection fails, fail closed for protected operations
- log the identity key, operation, and failure code
- allow safe retry on the next authenticated request

### 2. Stripe Webhook Ingestion

Goal:

- accept Stripe events safely even when they are retried, delayed, or delivered more than once

Rules:

- verify webhook signatures
- write an immutable event record keyed by Stripe event ID
- ACK only after durable receipt is complete
- process business effects from the durable event record, not directly from request state
- make handlers safe for at-least-once delivery

Stored data per event:

- event ID
- event type
- provider object IDs such as customer, subscription, checkout session, invoice
- payload hash or stored payload reference
- first seen at
- processed at
- processing outcome

Failure handling:

- if verification fails, reject the request and log it
- if durable write fails, return failure so Stripe retries
- if downstream processing fails after durable receipt, mark the event failed and enqueue retry or reconciliation

### 3. Billing Projection

Goal:

- maintain a stable application-facing view of billing state without coupling app access to raw webhook timing

Rules:

- store Stripe customer linkage before relying on email fallback
- store subscription linkage by stable external IDs
- project current subscription state into Convex read models
- treat the billing projection as retryable and recomputable

Failure handling:

- when a projection update fails, preserve the raw billing event for replay
- never discard unprocessed events
- record failure reason and retry count

### 4. Entitlement Projection

Goal:

- translate billing facts into application access safely and deterministically

Rules:

- entitlements are derived from durable billing state, not from client callbacks
- separate billing tables from entitlement tables
- make grant and revoke operations idempotent
- keep access checks cheap enough for synchronous server-side authorization

Failure handling:

- if entitlement projection fails, keep the source billing state intact
- retry entitlement recomputation independently of webhook receipt
- run scheduled reconciliation against Stripe subscription truth to repair drift

### 5. Signal Ingestion

Goal:

- ingest repeated upstream signal payloads without duplicating canonical state

Rules:

- write raw inbound payloads separately from normalized signal records
- use deterministic idempotency keys from source identity plus provider message/event identity
- make normalization replayable
- persist validation outcomes and normalization failures

Failure handling:

- malformed payloads go to failure capture, not silent discard
- repeated deliveries with the same idempotency key must be no-ops or safe updates
- normalization failures must be replayable after code fixes

### 6. Fan-Out and Delivery

Goal:

- deliver signals downstream without making signal creation fragile

Rules:

- use an outbox or job table for all downstream side effects
- do not call third-party APIs inline on the critical signal write path
- jobs must be claimed through indexed status and next-attempt fields
- claims must be bounded to small batches
- completion and failure updates must be idempotent

Job state model:

- `pending`
- `processing`
- `completed`
- `failed`
- `dead_lettered`

Failure handling:

- use exponential backoff for transient failures
- capture provider response codes and normalized error reasons
- move exhausted jobs to a dead-letter state, never infinite retry
- provide replay tooling for dead-lettered jobs

## Concurrency Rules

### Avoid Hot Documents

Do not place high-churn state on shared documents that many workflows update.

Prefer:

- separate job rows instead of one large queue document
- separate membership rows instead of one giant workspace access blob
- separate signal delivery rows instead of arrays on signal documents

### Keep Mutations Small

Prefer small deterministic mutations over large multi-purpose writes.

Why:

- smaller transactional scope reduces conflicts
- retries are simpler
- replay safety improves

### Use Indexes Before You Need Them

All hot-path reads must be index-backed.

Examples:

- billing event lookup by event ID
- subscriptions by Stripe customer ID
- entitlements by user or workspace plus feature
- signals by workspace plus created time
- jobs by status and next-attempt time

### Bound Every Query

Do not rely on unbounded scans or large `.collect()` calls in operational paths.

Use:

- pagination for user-facing feeds
- indexed `.take(n)` for worker claims
- scheduled continuation for large repair or migration work

## Failure Capture

Every critical async workflow should have a failure capture record or table.

Minimum fields:

- workflow type
- stable idempotency or entity key
- attempt count
- last error code
- last error message
- first failed at
- last attempted at
- replay status

Use this for:

- Stripe webhook failures
- entitlement projection failures
- signal normalization failures
- delivery failures

## Reconciliation Jobs

Reconciliation is required because third-party systems and webhooks are not perfect.

### Stripe Reconciliation

Scheduled job responsibilities:

- fetch current subscription truth from Stripe when needed
- compare Stripe truth with Convex billing projection
- repair missing or stale entitlement state
- surface unresolved mismatches for operators

### Signal Reconciliation

Scheduled or operator-triggered responsibilities:

- replay failed normalization events
- rebuild derived delivery jobs from canonical signals when safe
- identify stuck jobs in `processing` and requeue them after lease expiry

## Outbox Pattern

All external side effects should flow through an outbox-style boundary.

Applies to:

- downstream signal delivery
- email or notification sends
- any future Discord, Telegram, or webhook fan-out

Benefits:

- removes provider latency from core writes
- keeps retries explicit
- gives operators visibility into backlog and failures
- allows worker concurrency tuning without changing core app logic

## Observability Baseline

### Logs

Every critical workflow should emit structured logs with:

- workflow name
- entity or event ID
- attempt number
- outcome
- elapsed time
- normalized error code

### Metrics

Track at minimum:

- webhook receipt rate
- webhook failure rate
- duplicate event suppression count
- entitlement drift count
- signal ingest latency
- job backlog depth
- retry count by workflow
- dead-letter volume

### Alerts

Alert when:

- webhook failures are sustained
- entitlement reconciliation finds drift repeatedly
- job backlog exceeds threshold
- dead-letter volume grows
- processing leases remain stale beyond expected recovery windows

## Security-Linked Reliability

Reliability and security overlap in these areas:

- all auth and billing changes must be server-authorized
- webhook verification failures must be visible
- PII retention should be minimized in logs and payload archives
- access-changing operations need an audit trail
- environment configuration errors must fail loudly at startup where possible

## Implementation Checklist

- store immutable Stripe webhook events by event ID
- make billing and entitlement projections replayable
- use idempotency keys for signal ingestion
- move downstream side effects to job queues
- bound worker claims with indexed queries
- track retry count and terminal failure reason
- add reconciliation for Stripe and stuck jobs
- add structured logs and operator-visible failure tables

## Definition of Reliable

This system is reliable when:

- duplicate provider events do not duplicate business state
- retries do not corrupt access or signals
- failed jobs can be replayed safely
- no critical workflow depends on a single inline third-party call
- operators can explain and recover failures from recorded state
