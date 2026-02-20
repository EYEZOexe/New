# Website Production-Readiness Pass (2026-02-20)

## Goal

Remove remaining placeholder-driven UX in customer-facing website surfaces, harden auth/redirect behavior, and improve production baseline security/performance without breaking Convex data callbacks.

## Implemented

1. Live data replacement for homepage metrics/content
- Added `workspace:publicLandingSnapshot` Convex query for real market/news snapshot data.
- Replaced static homepage KPI values and sample highlight cards with live Convex-backed values.

2. Real connector source selection (no hardcoded defaults)
- Added `signals:listViewerConnectorOptions` Convex query to derive viewer-visible connector pairs from tier visibility rules.
- Added shared connector selection utilities + hook:
  - `website/app/workspace/lib/connectorSelection.ts`
  - `website/app/workspace/lib/useViewerConnectorSelection.ts`
- Updated dashboard and workspace signals pages to use real connector options rather than hardcoded `t1` / `conn_01`.

3. Auth/SSO flow hardening
- Added shared redirect sanitizer: `website/lib/redirectPath.ts`.
- Applied sanitizer to login/signup redirect handling.
- Hardened Discord OAuth callback route network handling with timeout + controlled redirect errors on upstream request failures.

4. Workspace UX polish
- Made topbar search actionable for module navigation (route jump on submit) instead of dead placeholder behavior.

5. Security baseline
- Added standard security headers in both Next.js apps (`website`, `admin`) via `next.config.ts` headers config.
- Updated admin metadata from scaffold defaults to production naming/description.

## Verification

- `bun test website/tests`
- `bun run typecheck` (website)
- `bun run build` (website)
- `bun run typecheck` (admin)
- `bun run build` (admin, with `NEXT_PUBLIC_CONVEX_URL` set in shell)

All commands passed.

