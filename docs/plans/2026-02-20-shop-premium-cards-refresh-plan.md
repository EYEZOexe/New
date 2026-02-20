# Shop Premium Cards Refresh Plan

> **Status:** Completed on 2026-02-20

**Goal:** Improve the `website` shop product cards to look more premium and conversion-focused.

**Architecture:** Keep existing shop data/query behavior unchanged and execute a UI-only enhancement in `ShopTierCard` with stronger hierarchy, tier-specific visual identity, and clearer duration/price selection affordances.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS utility classes, Bun.

---

## Completed Tasks

- [x] Reworked `ShopTierCard` visual language with tier-specific premium palettes and glow treatments (`basic`, `advanced`, `pro`). (2026-02-20)
- [x] Upgraded card hierarchy:
  - stronger title/header treatment
  - improved badge styling
  - clearer tier positioning cues
  (2026-02-20)
- [x] Redesigned duration selectors as richer option tiles with inline pricing and featured-value hinting. (2026-02-20)
- [x] Rebuilt selected-price block for stronger focus and better billing context visibility (`Selected Billing`, duration badge). (2026-02-20)
- [x] Improved highlights and CTA/footer area to feel cleaner and higher quality while preserving existing checkout behavior. (2026-02-20)

---

## Verification Evidence

- `cd website && bun run typecheck` (pass)
- `cd website && bun run build` (pass)
