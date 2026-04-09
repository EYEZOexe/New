# Product Roadmap

Living roadmap for rebuilding G3n S1gnals around the current stack: Next.js, Convex, Clerk, and Stripe.

This replaces the older roadmap that was tied to a different structure. The product direction is still the same: ingest trading signals, normalize them, sell access cleanly, and deliver a reliable multi-user SaaS experience. What changes here is the implementation strategy: simpler boundaries, fewer duplicated concerns, stronger reliability defaults, and a backend model that is safe under concurrency.

## North Star

Build a signal platform that can safely handle:

- many concurrent users reading live and historical signals
- many concurrent writes from signal ingestion and billing events
- deterministic access control across auth, billing, and entitlements
- replayable and observable workflows for failures, retries, and drift recovery

## Core Principles

- `SOLID`: each module owns one business capability and exposes a narrow API
- `DRY`: shared policies, validators, and mapping logic live in one place
- idempotency by default for webhooks, ingestion, and job processing
- append-only or immutable event history where auditability matters
- bounded reads and writes; no unbounded scans on hot paths
- explicit ownership boundaries between auth, billing, entitlements, signals, and delivery
- eventual consistency for side effects, strong consistency for entitlement decisions
- favor queue/outbox workflows over inline third-party side effects

## Stack Decisions

## Current Status

Now:

- `2026-04-09`: self-hosted Convex is in an unstable state under load; `https://convex.g3netic.com` is returning `502 Bad Gateway` and retention cleanup is still disabled in [`convex/crons.ts`](/f:/Github%20Projects/New/convex/crons.ts)
- `2026-04-09`: HTTP signal ingest now includes embed-hosted image media in inline hydration, so Discord messages whose charts only exist in embeds still mirror their images instead of landing as text-only signals
- payment webhook/customer tracking is being moved off full-table scans onto indexed lookups to reduce backend pressure as event volume grows
- payment email resolution and admin email conflict checks now prefer indexed `authAccounts.providerAndAccountId` lookups instead of scanning account rows
- role-sync and Discord bot admin list queries are being moved onto existing status/guild indexes to avoid broad operational scans
- signal viewer connector discovery now scopes mapping reads per connector, and workspace feed refreshes skip full rewrites when upstream data is unchanged
- mirror/media diagnostics now fetch rows by source message instead of loading connector-wide job/media sets into memory
- message filtering now supports both hostname matches and URL path/handle token matches so entries like `unityacademy` can suppress links such as `x.com/unityacademy/...`
- OIDC metadata currently reports `http://convex-backend.g3netic.com/http` as the issuer instead of `https://convex-backend.g3netic.com/http`, which needs to be corrected at the self-hosted service/proxy layer
- repo defaults now normalize public Convex auth/OIDC URLs to HTTPS for non-local deployments so Cloudflare Tunnel can front an internal HTTP origin safely

Next:

- run Convex deployment health checks (`convex insights`, failure logs, queue depth, table growth) from an environment that has `CONVEX_SELF_HOSTED_ADMIN_KEY`
- re-enable retention in small safe batches only after query/memory pressure is confirmed back under budget
- audit and remove remaining unbounded `.collect()` usage on hot/operator paths, especially large queue/history tables

Blockers:

- the repo workspace does not include `CONVEX_SELF_HOSTED_ADMIN_KEY`, so direct deployment insights/log access is currently blocked here
- self-hosted Convex/proxy configuration is unhealthy enough to produce `502` responses and incorrect public OIDC metadata

### Convex

Use Convex as the operational system of record for app state, signal pipelines, entitlements, jobs, and read models.

Best-practice defaults:

- define schemas and indexes intentionally up front
- query through indexes, never by collecting and filtering large datasets
- paginate all user-facing lists and admin feeds
- avoid hot documents by separating high-churn operational rows from stable entities
- use internal mutations/actions for background workflows and integration boundaries
- keep mutations small, deterministic, and safe for retries

### Clerk

Use Clerk for authentication, session management, and organization-aware identity if team or workspace support is needed.

Best-practice defaults:

- protect routes centrally with `clerkMiddleware`
- authorize server-side with `auth()` in App Router and route handlers
- never trust client-supplied user identifiers for access checks
- sync only the minimum identity metadata needed by the app
- treat Clerk as identity and Convex as application state

### Stripe

Use Stripe Billing for subscriptions, Stripe Checkout for signup and plan changes, and Customer Portal for self-serve subscription management.

Best-practice defaults:

- use Checkout Sessions for subscription start flows
- use Stripe Billing primitives, not manual renewal logic
- use Prices instead of deprecated plan patterns
- process webhooks with signature verification and idempotent event storage
- derive entitlements from Stripe events plus reconciliation jobs
- keep payment provider side effects and app entitlements decoupled

## Target Architecture

### 1. Identity Domain

Owns:

- Clerk user identity
- optional organizations or workspaces
- user profile projection in Convex
- user-to-workspace membership and roles

Rules:

- Clerk is the source of identity truth
- Convex stores app-specific profile, membership, and role state
- authorization decisions are computed server-side in Convex and Next.js

### 2. Billing Domain

Owns:

- Stripe customer linkage
- subscription state projection
- checkout session creation
- customer portal session creation
- webhook receipt, verification, replay, and reconciliation

Rules:

- store stable external IDs for customer, subscription, price, and event
- store every processed webhook event once
- never grant access based only on a frontend redirect
- webhook handlers must be retry-safe and duplicate-safe

### 3. Entitlements Domain

Owns:

- product-to-feature mapping
- access windows and feature flags
- seat limits if needed later
- billing-to-access translation

Rules:

- billing state and entitlement state are related but separate
- entitlements are computed from durable billing facts
- reads for access checks must be cheap and deterministic

### 4. Signals Domain

Owns:

- raw signal ingestion
- normalization and enrichment
- deduplication keys
- canonical signal records
- signal status and moderation lifecycle

Rules:

- keep raw ingress data separate from normalized signal documents
- make signal ingestion idempotent with provider/source message keys
- preserve enough source metadata for replay and debugging

### 5. Delivery Domain

Owns:

- fan-out jobs
- per-channel or per-user delivery state
- retry/backoff logic
- delivery observability

Rules:

- never perform all fan-out inline on the ingestion write path
- use claim/process/complete job flows
- keep job documents small and indexed by status plus next-attempt time
- persist failure reason and retry count for operational visibility

## Data Model Strategy

Design for growth from day one:

- `users`, `workspaces`, `memberships`
- `stripeCustomers`, `subscriptions`, `billingEvents`
- `entitlements`, `featureGrants`, `accessSnapshots`
- `signalSources`, `rawSignals`, `signals`, `signalDeliveries`
- `jobs` or scoped job tables such as `deliveryJobs`, `reconciliationJobs`

Modeling rules:

- do not store unbounded arrays inside primary documents
- create indexes for every hot read path before traffic grows
- avoid shared mutable counters unless they are truly required
- maintain denormalized read models only where they materially reduce read cost
- separate write-heavy state from read-heavy state to reduce contention

## Concurrency and Reliability Roadmap

### Phase 1. Foundation Reset

Goal: establish clean module boundaries and production-safe defaults before feature expansion.

- define domain modules in Convex by business capability, not by page
- standardize naming, validators, auth guards, and internal/public API boundaries
- add a single source of truth for environment/config validation
- document ownership boundaries for Clerk, Stripe, and Convex concerns

Exit criteria:

- every Convex function has validators and clear auth rules
- every table has an owner and documented purpose
- every hot path has an index plan

### Phase 2. Auth and Workspace Model

Goal: make identity and authorization predictable.

- integrate Clerk middleware and protected route patterns in Next.js
- create Convex user projection keyed by Clerk token identity
- add membership and role model for workspace-scoped access
- make all privileged operations resolve identity server-side

Exit criteria:

- protected pages and APIs cannot rely on client-trusted IDs
- user bootstrap is automatic and idempotent
- role checks are centralized and reusable

### Phase 3. Billing and Entitlements

Goal: make subscription state correct even under retries, duplicates, and missed events.

- implement Stripe Checkout subscription flows
- implement Customer Portal session flow
- store Stripe customer and subscription mappings in Convex
- add verified webhook ingestion with immutable event log
- build entitlement projection from billing events
- add scheduled reconciliation for subscription drift

Exit criteria:

- duplicate webhooks do not duplicate state or access
- subscription cancellation, renewal, and payment failure update access correctly
- access can be recomputed from durable billing data

### Phase 4. Signal Ingestion Pipeline

Goal: ingest and normalize signals safely under load.

- create raw ingestion endpoint or mutation with idempotency keys
- store source payloads separately from normalized signal records
- build normalization pipeline with validation and failure capture
- add dedupe rules for repeated upstream signals
- add replay tooling for failed or skipped ingress events

Exit criteria:

- repeated inbound payloads do not create duplicate canonical signals
- malformed input is captured with actionable failure metadata
- operators can replay failed ingress safely

### Phase 5. Delivery and Fan-Out

Goal: deliver signals to many consumers without making ingestion fragile.

- implement outbox/job model for downstream delivery
- separate create, retry, dead-letter, and reconciliation states
- add bounded claims by indexed status and scheduled retry time
- enforce exponential backoff and max-attempt policies
- record per-delivery outcome and latency metrics

Exit criteria:

- signal creation remains fast even when downstream delivery slows down
- retries are deterministic and observable
- failed jobs are inspectable and replayable

### Phase 6. Read Models and User Experience

Goal: keep user-facing reads fast without compromising write-path simplicity.

- add paginated signal feeds and dashboard queries
- build role-aware entitlement-aware views
- create lightweight read models for homepage, dashboard, and admin surfaces
- keep admin diagnostics separate from customer-facing reads

Exit criteria:

- no user-facing list relies on unbounded reads
- access-aware rendering is driven from server-side truth
- dashboard performance remains stable as signal volume grows

### Phase 7. Observability and Operations

Goal: make failures visible before users report them.

- structured logs for webhook, ingest, entitlement, and delivery flows
- metrics for latency, retry count, backlog depth, duplicate suppression, and failure rate
- dashboards for queue depth, stale jobs, webhook failures, and access drift
- runbooks for replay, reconciliation, and incident triage
- self-hosted Convex health checks must include proxy status, OIDC metadata validation, queue depth, and table-growth tracking

Exit criteria:

- each critical workflow has success/failure telemetry
- dead-letter queues or failure tables are queryable from admin tooling
- on-call debugging does not require raw database archaeology

## Engineering Standards

### SOLID in Practice

- one module owns one business policy
- infrastructure wrappers do not contain domain rules
- domain services depend on abstractions and shared helpers, not UI concerns
- public functions expose stable contracts; internal helpers absorb implementation churn

### DRY in Practice

- centralize auth guards, provider ID mapping, and entitlement evaluation
- centralize Stripe event parsing and normalization
- centralize signal validation and dedupe logic
- centralize retry policies and error codes

### Performance Rules

- no `.collect()` on potentially unbounded queries
- no table scans on hot user or worker paths
- no large mutable arrays in documents
- no inline third-party side effects inside critical state mutations when a queue will do

## Security and Compliance Defaults

- verify Stripe webhook signatures
- scope secrets and environment variables per environment
- minimize stored personal data from Clerk and Stripe
- store external IDs and hashes where full payload retention is not required
- enforce server-side authorization for every billing and signal admin action
- keep audit trails for access-changing operations

## Delivery Order

Recommended implementation order:

1. foundation reset
2. Clerk auth and workspace model
3. Stripe billing plus entitlements
4. signal ingestion and normalization
5. delivery jobs and retry loops
6. user-facing dashboards and admin tooling
7. deep observability, replay tools, and scale tuning

## What We Are Explicitly Avoiding

- coupling billing success redirects directly to access grants
- storing all workflow state on one hot document
- mixing raw third-party payloads with clean application read models
- building subscription logic manually on top of payment intents
- relying on client-side auth state for authorization
- scaling with scans first and indexes later

## Definition of Done

This roadmap is only complete when:

- auth, billing, entitlements, and signals have clear bounded domains
- the write path is safe under duplicate events and concurrent processing
- customer-facing reads are indexed and paginated
- operational failures are replayable instead of mysterious
- the system can degrade gracefully when Stripe, Clerk, or downstream delivery is slow

## Notes

- This roadmap assumes Clerk remains the identity provider, Convex remains the application backend, and Stripe remains the billing provider.
- If Discord or other downstream channels are added back into scope, they should remain delivery-domain concerns behind the same outbox and retry model.
- Reliability ideas from `docs/reliability.md` still apply and should be treated as implementation constraints, not optional polish.
