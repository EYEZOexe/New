# Trader Workspace Expansion Design

**Date:** 2026-02-17

## Context

The current `website` app has a strong foundation (`home`, `shop`, `dashboard`, auth), but the target product direction now requires a deeper member workspace similar in information density and workflow coverage to the provided references:

- left navigation rail with persistent context
- top utility bar (search, live status, quick actions)
- multi-module dashboard experience (markets, live intel, signals, indicators, strategies, journal, news)
- modal-driven workflows (trade logging, quick symbol view, trade detail, strategy detail)

The objective is to integrate these patterns into our product system without cloning another product surface, while preserving existing Convex-backed subscription gating and Discord-link flows.

## Product Goals

- Introduce a cohesive authenticated workspace IA that scales beyond a single dashboard page.
- Preserve existing business logic (subscription access, tier visibility, Discord linking, checkout return).
- Add new modules incrementally with clear release gates and measurable UX quality.
- Keep performance and maintainability standards (shared primitives, typed adapters, consistent error handling).

## Non-Goals

- Replacing current auth/payment architecture.
- Shipping all advanced analytics backends in one release.
- Building custom chart engines; reuse existing `recharts` dependency.

## Design Principles

- Keep a single visual language across modules: dark trading-console aesthetic, restrained accent color, high contrast data states.
- Prefer composable primitives over bespoke one-off UI.
- Separate shell concerns (navigation, layout, responsiveness) from module concerns (markets/news/journal logic).
- Make every dense surface filterable and stateful (search, tabs, timeframe, source, status).

## Reference Pattern Extraction

From the provided screens, the reusable pattern library is:

- **Shell patterns**
  - persistent desktop sidebar + mobile drawer
  - fixed top utility row
  - section heading + short status subtitle
- **Data display patterns**
  - KPI strips/cards
  - sortable/filterable lists and tables
  - compact chart cards and sparkline rows
  - live feed rows with attachment/media previews
- **Interaction patterns**
  - segmented controls (timeframe, category, polarity)
  - sticky table headers for large lists
  - drawer/modal detail drill-down
  - inline health/live badges

## Information Architecture

Canonical authenticated workspace:

- `/workspace/overview`
- `/workspace/markets`
- `/workspace/live-intel`
- `/workspace/signals`
- `/workspace/indicators`
- `/workspace/strategies`
- `/workspace/journal`
- `/workspace/news`

Compatibility routes:

- `/dashboard` -> redirect to `/workspace/overview`
- existing `/shop`, `/checkout/return`, `/login`, `/signup` remain canonical

## Data Architecture

### Reuse Existing Convex Domains

- `users:viewer` for identity and access state
- `signals:listRecent` for feed content
- `connectors:listMappings` for tier visibility context
- existing Discord link/unlink mutations

### Introduce Workspace Data Adapters

Add a typed adapter layer under `website/app/workspace/lib/`:

- normalize market snapshot payloads into UI card/list models
- normalize live-intel/indicator/strategy records
- normalize journal entries for card, calendar, and trade-detail views
- normalize news source/article cards

This isolates page components from backend shape churn.

### Incremental Backend Scope

Phase 1 can run on static/mock adapters for non-critical modules (`markets`, `live-intel`, `strategies`, `journal`, `news`) while `overview` + `signals` remain fully live from existing Convex data.

## Component System Architecture

Create a workspace component domain:

- `website/components/workspace/workspace-shell.tsx`
- `website/components/workspace/workspace-sidebar.tsx`
- `website/components/workspace/workspace-topbar.tsx`
- `website/components/workspace/workspace-section-header.tsx`
- `website/components/workspace/kpi-card.tsx`
- `website/components/workspace/metric-strip.tsx`
- `website/components/workspace/feed-card.tsx`
- `website/components/workspace/chart-card.tsx`
- `website/components/workspace/detail-dialog.tsx`

The shell owns layout and responsive behavior; modules own data and composition.

## Context7-Guided Technical Direction

- `shadcn/ui` guidance supports a composable sidebar pattern (`SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`) and `useSidebar()` control flow for desktop/mobile state management.
- `Next.js App Router` guidance supports route-group nested layout composition (server layout wrapping interactive client layout) so shell state and navigation remain stable across child pages.
- `Recharts` guidance supports compact dashboard chart composition with `ResponsiveContainer`, simplified axes/tooltips for dense cards, and accessible keyboard navigation defaults in recent versions.

### Context7 References

- shadcn sidebar docs: https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/components/base/sidebar.mdx
- shadcn data-table docs: https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/components/base/data-table.mdx
- shadcn dashboard blocks changelog note: https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/changelog/2024-03-blocks.mdx
- Next.js App Router migration/layout docs: https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/migrating/app-router-migration.mdx
- Next.js redirect/navigation docs: https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/redirecting.mdx
- Recharts accessibility docs: https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx

## UX and Accessibility Requirements

- Keyboard focus order must include sidebar, top controls, filters, and table rows.
- All icon-only actions require `sr-only` labels.
- Color is never the only state indicator (use text labels + badges for gain/loss, live/offline, bullish/bearish).
- Mobile must use off-canvas nav and stacked modules without horizontal clipping.

## Observability Requirements

When new workspace modules are introduced, log outcomes in frontend/backend:

- frontend: module load state, filter selections, empty-state reason
- backend: query count windows, gating reasons, payload cardinality

Prefix logs by module (`[workspace/markets]`, `[workspace/news]`, etc.).

## Rollout Plan (High-Level)

1. Build workspace shell and route group.
2. Migrate existing dashboard into `overview` module.
3. Add markets/live-intel/signals modules.
4. Add indicators/strategies/journal/news modules.
5. Add detail dialogs and advanced interactions.
6. Performance pass + accessibility pass + docs sync.

## Risks / Mitigations

- **Risk:** UI scope expands faster than backend readiness.
  - **Mitigation:** adapter-first module contracts with phased live data enablement.
- **Risk:** shell refactor can break current `/dashboard` flows.
  - **Mitigation:** keep redirect compatibility and retain existing hooks first; move behavior second.
- **Risk:** dense pages regress mobile usability.
  - **Mitigation:** mobile-first breakpoints and explicit smoke checks per module.
