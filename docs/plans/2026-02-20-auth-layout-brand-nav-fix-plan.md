# Auth Layout + Brand + Nav Visibility Fix Plan

> **Status:** Completed on 2026-02-20

**Goal:** Fix login/signup layout quality, rebrand website naming to `G3n S1gnals`, and hide the top-nav `Log in` button for authenticated users.

**Architecture:** Keep auth/business logic unchanged and apply focused UI/branding updates in shared website shell/navigation plus auth pages.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Convex React auth state, Tailwind CSS, Bun.

---

## Completed Tasks

- [x] Updated marketing navigation branding from Sleep Crypto to `G3n S1gnals` and icon initials from `SC` to `G3`. (2026-02-20)
- [x] Added auth-aware top-nav login visibility logic (`useConvexAuth`) so `Log in` is hidden once the user is authenticated. (2026-02-20)
- [x] Reworked `/login` layout to fix the awkward wide-screen composition:
  - moved auth form to a dedicated primary column
  - reduced oversized headline treatment
  - tightened supporting content into balanced `site-soft` blocks
  (2026-02-20)
- [x] Reworked `/signup` layout using the same balanced composition pattern as `/login`. (2026-02-20)
- [x] Updated brand name in website/app metadata + workspace sidebar and admin metadata title for consistency. (2026-02-20)

---

## Verification Evidence

- `cd website && bun run typecheck` (pass)
- `cd admin && bun run typecheck` (pass)
- `cd website && bun run build` (pass)
