# Trader Workspace Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a multi-module authenticated trading workspace in `website` that integrates the referenced dashboard elements while preserving existing Convex auth, entitlement, and signal-gating behavior.

**Architecture:** Introduce a dedicated App Router workspace route group with a shared shell (sidebar + topbar) and migrate the current dashboard into an `overview` module. Add module pages (`markets`, `live-intel`, `signals`, `indicators`, `strategies`, `journal`, `news`) behind typed adapter boundaries so non-critical modules can launch with staged data backends. Reuse shadcn primitives and Recharts for composable, responsive UI.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, shadcn/ui, Recharts, Convex queries/mutations, Bun (`typecheck`, `build`).

---

### Task 1: Establish workspace routing and navigation contracts

**Files:**
- Create: `website/app/workspace/layout.tsx`
- Create: `website/app/workspace/overview/page.tsx`
- Create: `website/lib/workspaceRoutes.ts`
- Create: `website/tests/workspaceRoutes.test.js`
- Modify: `website/app/dashboard/page.tsx`

**Step 1: Write failing route helper tests**

Test route-state helpers for:
- active nav key resolution for each `/workspace/*` route
- compatibility mapping from `/dashboard` to `/workspace/overview`

**Step 2: Run tests to verify failure**

Run: `cd website && bun test tests/workspaceRoutes.test.js`  
Expected: FAIL (missing helper module).

**Step 3: Implement minimal helper and route scaffolding**

- Add typed nav model in `workspaceRoutes.ts`
- Add `workspace/layout.tsx` + placeholder `overview/page.tsx`
- Convert `dashboard/page.tsx` to redirect behavior

**Step 4: Re-run tests**

Run: `cd website && bun test tests/workspaceRoutes.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add website/app/workspace/layout.tsx website/app/workspace/overview/page.tsx website/lib/workspaceRoutes.ts website/tests/workspaceRoutes.test.js website/app/dashboard/page.tsx
git commit -m "feat(website): scaffold workspace route group and navigation contracts"
```

### Task 2: Build shared workspace shell primitives

**Files:**
- Create: `website/components/workspace/workspace-shell.tsx`
- Create: `website/components/workspace/workspace-sidebar.tsx`
- Create: `website/components/workspace/workspace-topbar.tsx`
- Create: `website/components/workspace/workspace-section-header.tsx`
- Modify: `website/app/globals.css`

**Step 1: Implement shell with responsive behavior**

- desktop persistent sidebar
- mobile drawer/sidebar toggle
- top utility bar with search + live status slot

**Step 2: Wire shell into `workspace/layout.tsx`**

Ensure child page rendering keeps shell persistent across route transitions.

**Step 3: Run static verification**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add website/components/workspace/workspace-shell.tsx website/components/workspace/workspace-sidebar.tsx website/components/workspace/workspace-topbar.tsx website/components/workspace/workspace-section-header.tsx website/app/workspace/layout.tsx website/app/globals.css
git commit -m "feat(website): add workspace shell with responsive sidebar and topbar"
```

### Task 3: Migrate current dashboard logic into Overview module

**Files:**
- Create: `website/app/workspace/overview/useOverviewController.ts`
- Create: `website/app/workspace/overview/components/overview-hero.tsx`
- Create: `website/app/workspace/overview/components/overview-signal-feed.tsx`
- Modify: `website/app/dashboard/useDashboardController.ts`
- Modify: `website/app/workspace/overview/page.tsx`

**Step 1: Extract reusable controller surface**

Move existing dashboard view logic into an overview-specific controller while preserving existing query contracts.

**Step 2: Compose overview page sections**

- KPI strip (subscription/tier/access)
- visibility summary
- live signal feed

**Step 3: Verify entitlement and discord actions still work**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add website/app/workspace/overview/useOverviewController.ts website/app/workspace/overview/components/overview-hero.tsx website/app/workspace/overview/components/overview-signal-feed.tsx website/app/dashboard/useDashboardController.ts website/app/workspace/overview/page.tsx
git commit -m "refactor(website): migrate dashboard experience into workspace overview"
```

### Task 4: Add typed workspace data adapters

**Files:**
- Create: `website/app/workspace/lib/types.ts`
- Create: `website/app/workspace/lib/marketAdapter.ts`
- Create: `website/app/workspace/lib/liveIntelAdapter.ts`
- Create: `website/app/workspace/lib/journalAdapter.ts`
- Create: `website/app/workspace/lib/newsAdapter.ts`
- Create: `website/tests/workspaceAdapters.test.js`

**Step 1: Write failing adapter tests**

Validate:
- stable output shape
- empty/null input handling
- deterministic sorting/filter defaults

**Step 2: Run tests**

Run: `cd website && bun test tests/workspaceAdapters.test.js`  
Expected: FAIL.

**Step 3: Implement minimal adapter functions**

Keep pure functions only; no component dependencies.

**Step 4: Re-run tests**

Run: `cd website && bun test tests/workspaceAdapters.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add website/app/workspace/lib/types.ts website/app/workspace/lib/marketAdapter.ts website/app/workspace/lib/liveIntelAdapter.ts website/app/workspace/lib/journalAdapter.ts website/app/workspace/lib/newsAdapter.ts website/tests/workspaceAdapters.test.js
git commit -m "feat(website): add typed workspace data adapters with tests"
```

### Task 5: Implement Markets + Live Intel modules

**Files:**
- Create: `website/app/workspace/markets/page.tsx`
- Create: `website/app/workspace/markets/components/markets-kpi-row.tsx`
- Create: `website/app/workspace/markets/components/markets-table.tsx`
- Create: `website/app/workspace/live-intel/page.tsx`
- Create: `website/app/workspace/live-intel/components/live-intel-grid.tsx`
- Create: `website/components/workspace/chart-card.tsx`

**Step 1: Build markets module**

- KPI cards
- searchable instrument table/list
- compact chart cells (sparkline style)

**Step 2: Build live-intel module**

- multi-card intel layout
- timeframe tabs and polarity toggles
- responsive reflow for small screens

**Step 3: Verify**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add website/app/workspace/markets/page.tsx website/app/workspace/markets/components/markets-kpi-row.tsx website/app/workspace/markets/components/markets-table.tsx website/app/workspace/live-intel/page.tsx website/app/workspace/live-intel/components/live-intel-grid.tsx website/components/workspace/chart-card.tsx
git commit -m "feat(website): add markets and live-intel workspace modules"
```

### Task 6: Implement Signals + Indicators + Strategies modules

**Files:**
- Create: `website/app/workspace/signals/page.tsx`
- Create: `website/app/workspace/signals/components/analyst-feed.tsx`
- Create: `website/app/workspace/indicators/page.tsx`
- Create: `website/app/workspace/indicators/components/indicator-panels.tsx`
- Create: `website/app/workspace/strategies/page.tsx`
- Create: `website/app/workspace/strategies/components/strategy-list.tsx`
- Create: `website/components/workspace/detail-dialog.tsx`

**Step 1: Implement signals workspace**

- analyst feed list
- alert cards and filters
- preserve attachment-safe rendering conventions already in project

**Step 2: Implement indicators workspace**

- two-column alert/watchlist cards
- live badges and category chips

**Step 3: Implement strategies workspace**

- strategy filters and cards
- strategy detail expansion/dialog pattern

**Step 4: Verify**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add website/app/workspace/signals/page.tsx website/app/workspace/signals/components/analyst-feed.tsx website/app/workspace/indicators/page.tsx website/app/workspace/indicators/components/indicator-panels.tsx website/app/workspace/strategies/page.tsx website/app/workspace/strategies/components/strategy-list.tsx website/components/workspace/detail-dialog.tsx
git commit -m "feat(website): add signals indicators and strategies workspace modules"
```

### Task 7: Implement Journal module and trade logging workflow

**Files:**
- Create: `website/app/workspace/journal/page.tsx`
- Create: `website/app/workspace/journal/components/journal-kpis.tsx`
- Create: `website/app/workspace/journal/components/pnl-calendar.tsx`
- Create: `website/app/workspace/journal/components/trade-log-table.tsx`
- Create: `website/app/workspace/journal/components/log-trade-dialog.tsx`
- Create: `website/app/workspace/journal/lib/tradeFormSchema.ts`
- Create: `website/tests/tradeFormSchema.test.js`

**Step 1: Write failing schema tests**

Validate required fields, direction/status enums, and numeric bounds.

**Step 2: Run tests**

Run: `cd website && bun test tests/tradeFormSchema.test.js`  
Expected: FAIL.

**Step 3: Implement schema + journal UI skeleton**

- KPI cards
- calendar/equity placeholders
- trade log empty/filled states
- log-trade modal form

**Step 4: Re-run tests + app verification**

Run:
- `cd website && bun test tests/tradeFormSchema.test.js`
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add website/app/workspace/journal/page.tsx website/app/workspace/journal/components/journal-kpis.tsx website/app/workspace/journal/components/pnl-calendar.tsx website/app/workspace/journal/components/trade-log-table.tsx website/app/workspace/journal/components/log-trade-dialog.tsx website/app/workspace/journal/lib/tradeFormSchema.ts website/tests/tradeFormSchema.test.js
git commit -m "feat(website): add journal module with validated log-trade workflow"
```

### Task 8: Implement News module and quick-view dialogs

**Files:**
- Create: `website/app/workspace/news/page.tsx`
- Create: `website/app/workspace/news/components/news-feature-card.tsx`
- Create: `website/app/workspace/news/components/news-grid.tsx`
- Create: `website/app/workspace/components/symbol-quick-view-dialog.tsx`
- Create: `website/app/workspace/components/trade-detail-dialog.tsx`
- Create: `website/app/workspace/components/strategy-detail-dialog.tsx`

**Step 1: Build news page**

- source chips
- featured story panel
- card grid with source and age metadata

**Step 2: Build reusable dialogs**

- symbol quick view (price/high-low/funding, CTA links)
- trade detail modal
- strategy detail modal

**Step 3: Verify**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add website/app/workspace/news/page.tsx website/app/workspace/news/components/news-feature-card.tsx website/app/workspace/news/components/news-grid.tsx website/app/workspace/components/symbol-quick-view-dialog.tsx website/app/workspace/components/trade-detail-dialog.tsx website/app/workspace/components/strategy-detail-dialog.tsx
git commit -m "feat(website): add news module and reusable quick-view dialogs"
```

### Task 9: Add module-level logging and empty/error state standards

**Files:**
- Modify: `website/app/workspace/overview/useOverviewController.ts`
- Modify: `website/app/workspace/markets/page.tsx`
- Modify: `website/app/workspace/live-intel/page.tsx`
- Modify: `website/app/workspace/signals/page.tsx`
- Modify: `website/app/workspace/journal/page.tsx`
- Modify: `website/app/workspace/news/page.tsx`

**Step 1: Add structured frontend logs**

Use module-specific prefixes and include filter + record-count metadata.

**Step 2: Standardize empty/error states**

Ensure all modules display consistent, actionable empty-state messaging.

**Step 3: Verify**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add website/app/workspace/overview/useOverviewController.ts website/app/workspace/markets/page.tsx website/app/workspace/live-intel/page.tsx website/app/workspace/signals/page.tsx website/app/workspace/journal/page.tsx website/app/workspace/news/page.tsx
git commit -m "chore(website): add workspace observability and standardized empty states"
```

### Task 10: Final verification, smoke tests, and roadmap sync

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `docs/plans/2026-02-17-trader-workspace-expansion-design.md` (only if scope changed)

**Step 1: Run verification**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`

Expected: PASS.

**Step 2: Manual smoke checklist**

Validate:
- sidebar/topbar behavior on desktop/mobile
- `/dashboard` redirect and `/workspace/*` route navigation
- overview entitlement + visibility + discord actions
- list filtering and tab controls across module pages
- dialog focus trapping and keyboard close behavior

**Step 3: Update roadmap**

Add status and links for:
- `docs/plans/2026-02-17-trader-workspace-expansion-design.md`
- `docs/plans/2026-02-17-trader-workspace-expansion-plan.md`

**Step 4: Commit**

```bash
git add docs/roadmap.md docs/plans/2026-02-17-trader-workspace-expansion-design.md docs/plans/2026-02-17-trader-workspace-expansion-plan.md
git commit -m "docs: add trader workspace expansion design and implementation plan"
```

