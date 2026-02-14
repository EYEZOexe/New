# Convex Adoption Design

**Date:** 2026-02-14

## Context

We are pivoting the backend to Convex and treating it as the plan of record going forward.

This includes a hard reset of project documentation so `docs/roadmap.md` and related docs do not
describe the previous backend as the intended architecture.

## Goals

- Make Convex the single source of truth for backend state and server functions.
- Stop creating new backend features on legacy code paths.
- Provide a migration plan that is explicit about risks, verification, and rollback.

## Non-Goals

- Complete the Convex migration in this change.
- Remove legacy backend code immediately (that is tracked as planned work).

## Documentation Reset (This Change)

Delete old backend-specific docs and replace them with a Convex-first baseline:

- Replace `docs/roadmap.md` with a Convex roadmap and reset checklist progress.
- Replace `docs/reliability.md` with Convex-oriented reliability patterns.
- Replace `README.md` with a Convex-first overview.
- Update `AGENTS.md` to reflect Convex as the infrastructure boundary.
- Replace prior `docs/plans/*` with a single Convex adoption design and plan.

## Migration Strategy (High Level)

1. Establish Convex schema for users, subscriptions, webhook events, Discord linkage, role sync jobs, signals.
2. Port payments and access gating first (highest business impact).
3. Port Discord linking and role sync queue next.
4. Port signal ingestion and dashboard feed.
5. Port bot mirroring to read from Convex.
6. Remove legacy backend packages, env vars, scripts, and endpoints.

## Key Risks

- Identity mapping across web, bot, and webhook processing.
- Consistent idempotency semantics for payment webhooks.
- Data migration and cutover order to avoid downtime.

