# Convex Auth Hard Cutover Design (Fresh Start)

**Date:** 2026-02-14

## Decision

We will do a **hard cutover** to Convex as the single backend, and we will use **Convex Auth**
for `apps/web` (and `apps/admin`) with **email + password** sign-in.

We will **start fresh** in Convex: no Appwrite user/subscription migration.

## Goals

- Convex is the single source of truth for backend state and server functions.
- Replace Appwrite-backed auth/session flows in `apps/web` with Convex Auth.
- Ensure `/dashboard` is gated by Convex Auth (signed-in required).
- Keep a clear path for future paid-gating (subscriptions in Convex), without implementing payments in this slice.

## Non-Goals (This Slice)

- Migrate existing Appwrite users/subscriptions/signals.
- Implement Sell.app webhook ingestion in Convex.
- Implement Discord linking, role sync, or signal ingestion/mirroring.
- Remove legacy code immediately (that is tracked as follow-up cleanup after the cutover works).

## Architecture

- `apps/web` uses Convex client + Convex Auth for signup/login/session management.
- `apps/admin` uses the same Convex Auth foundation and is gated initially via a simple allowlist
  (e.g. email allowlist) until a proper admin role model exists in Convex.
- Convex holds:
  - `users` table keyed by the Convex Auth subject (stable identifier).
  - `subscriptions` table keyed by the same user identifier (future paid gating).

## Data Model (Initial)

Tables and indexes are designed for the critical queries we need immediately:

- `users`
  - `subject` (Convex Auth subject, stable)
  - `email` (normalized)
  - `createdAt`
  - Indexes:
    - `by_subject`
    - `by_email`

- `subscriptions` (stub for future work)
  - `subject`
  - `status` (e.g. "active", "inactive")
  - `plan` (optional)
  - `updatedAt`
  - Indexes:
    - `by_subject`

## Cutover Plan (High Level)

1. Initialize Convex in-repo (self-host config already assumed by deployment).
2. Implement Convex Auth email+password flows for `apps/web`:
   - `/signup` creates account and signs in.
   - `/login` signs in.
   - `/logout` signs out.
3. Replace `apps/web` auth context and gating (`/dashboard`) to use Convex Auth.
4. Gate `apps/admin` with Convex Auth and an allowlist.
5. Add verification:
   - `pnpm -w typecheck`
   - `pnpm -w build` when claiming builds work

## Legacy / Migration Notes

- Treat Appwrite packages, scripts, and API routes as legacy.
- Do not add features to Appwrite paths.
- After Convex Auth is live and stable, schedule a cleanup task to remove:
  - `packages/appwrite`
  - `scripts/appwrite/*`
  - Appwrite-related env vars and `/api/appwrite/*` surfaces

