# Marketing Nav Dashboard Link Plan

> **Status:** Completed on 2026-02-20

**Goal:** Show a top-navbar `Dashboard` action for authenticated website users.

**Architecture:** Keep existing auth and route logic unchanged; update shared marketing nav visibility rules to conditionally render `Dashboard` when `useConvexAuth()` reports an authenticated session.

**Tech Stack:** Next.js App Router, React 19, Convex React auth state, TypeScript, Tailwind CSS, Bun.

---

## Completed Tasks

- [x] Added authenticated-only `Dashboard` button to `website/components/site/marketing-nav.tsx`. (2026-02-20)
- [x] Kept existing unauthenticated behavior intact (`Log in` shown only for non-authenticated users). (2026-02-20)
- [x] Preserved active-route styling parity for the new `Dashboard` nav item. (2026-02-20)

---

## Verification Evidence

- `cd website && bun run typecheck` (pass)
