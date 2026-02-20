# Website Design Improvement Plan

> **Status:** Completed on 2026-02-20

**Goal:** Execute a full design-quality pass across `website` so marketing pages and workspace modules share a cleaner, more intentional visual system.

**Architecture:** Improve design from shared layers outward: global tokens and utility classes first, then shell/navigation, then module/page surfaces for consistent hierarchy and interaction affordances.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS (`@theme` + utility classes), Bun.

---

## Completed Tasks

- [x] Audit website UI surfaces (`/`, auth, shop, checkout, workspace modules) and identify reusable design gaps. (2026-02-20)
- [x] Upgrade `website/app/globals.css` with stronger surface tokens, richer background composition, shared hover/motion utilities, and accessibility-safe reduced-motion handling. (2026-02-20)
- [x] Redesign shared frame/navigation primitives for better product identity and layout rhythm:
  - `website/components/site/page-frame.tsx`
  - `website/components/site/marketing-nav.tsx`
  - `website/components/workspace/workspace-sidebar.tsx`
  - `website/components/workspace/workspace-topbar.tsx` (including live clock/status)
  - `website/components/workspace/workspace-section-header.tsx`
  - `website/components/site/section-header.tsx`
  - `website/components/workspace/workspace-app-frame.tsx`
  (2026-02-20)
- [x] Apply cross-module consistency updates to high-traffic cards/tables/feeds with shared hover depth and cleaner row interactions:
  - Dashboard overview + signals feed
  - Shop hero/tier cards + auth form card
  - Markets table/KPI cards
  - Live intel cards
  - Signals analyst feed cards
  - Indicators, strategies, news cards
  - Journal KPI/cards/tables
  (2026-02-20)
- [x] Improve page-level composition rhythm and staged reveal pacing on `home`, `shop`, `login`, `signup`, and `checkout/return`. (2026-02-20)

---

## Verification Evidence

- `cd website && bun run typecheck` (pass)
- `cd website && bun run build` (pass)
