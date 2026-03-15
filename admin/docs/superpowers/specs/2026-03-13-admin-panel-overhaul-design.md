# Admin Panel Overhaul — Design Spec

**Date:** 2026-03-13
**Scope:** Full overhaul + visual rebrand (Approach C)
**Stack:** Next.js App Router, Tailwind CSS 4, shadcn UI, Convex

---

## Problem Statement

The current admin panel has several usability problems:

- **Mirror jobs are buried** — requires Mappings → Configure → scroll to bottom
- **Navigation is confusing** — "Mappings" is a non-obvious label, Filtering is disconnected from connectors, no logical grouping
- **No overview** — landing on the Mappings list gives no health summary at a glance
- **Connector detail page is a long single scroll** — status, controls, runtime, seat configs, routes, and jobs all stacked vertically
- **Inconsistent page layouts** — each page has its own ad-hoc structure

---

## Goals

1. Make mirror jobs and connector health immediately visible
2. Reorganise navigation into logical groups
3. Break the connector detail page into focused tabs
4. Improve individual page layouts across the board
5. Refresh the visual design — more premium, consistent feel

---

## Section 1: Layout Shell & Navigation

### Sidebar Groups

```
Dashboard                    ← new top-level home
─────────────────────────────
CONNECTORS
  Mappings
  Filtering
─────────────────────────────
DISCORD
  Bot Config
─────────────────────────────
SHOP
  Catalog
  Policies
  Customers
  Statistics
```

### `adminRoutes.ts` Type System Changes

The existing rigid type system (`AdminNavItem`, `AdminNavGroup`, `AdminNavState`) is extended:

```ts
// AdminNavItem gains "dashboard"
export type AdminNavItem = "dashboard" | "mappings" | "filtering" | "discord-bot";

// AdminNavGroup gains "connectors" (renames "shop" stays)
export type AdminNavGroup = "connectors" | "shop";

// AdminNavState updated accordingly
export type AdminNavState = {
  activeItem: AdminNavItem | null;
  activeGroup: AdminNavGroup | null;
  activeShopRoute: AdminShopRoute | null;
};
```

`getAdminNavState(pathname)` is updated to return `activeItem: "dashboard"` for the `/` route, and `activeGroup: "connectors"` for `/mappings` and `/filtering` routes. `buildAdminBreadcrumbs` is updated to handle the `/` route (returns empty breadcrumbs) and the `?tab=` connector detail route (appends the active tab label to the breadcrumb trail).

The CONNECTORS group label in the sidebar is purely visual — it is not an `AdminNavGroup` value used for routing logic. Only `"shop"` and `"connectors"` are `AdminNavGroup` values.

### `CONNECTOR_SUB_NAV_TABS` Constant

```ts
export const CONNECTOR_SUB_NAV_TABS = [
  { label: "Overview", tabValue: "overview" },
  { label: "Routes",   tabValue: "routes"   },
  { label: "Jobs",     tabValue: "jobs"     },
  { label: "Settings", tabValue: "settings" },
] as const;
```

The sidebar maps over this array to render tab links as `/mappings/[tenantKey]/[connectorId]?tab=[tabValue]`. The Overview sub-nav link always includes `?tab=overview` explicitly (not omitted) to keep all tab links consistent in format.

### Contextual Sub-Nav

When the current URL matches `/mappings/[tenantKey]/[connectorId]` (with any `?tab=`), the sidebar expands a sub-menu beneath "Mappings":

```
CONNECTORS
  Mappings
    └ t1 / conn_01
        Overview
        Routes
        Jobs  [4]    ← red badge when failures exist
        Settings
  Filtering
```

**Sub-nav collapse rules:**
- Sub-menu shown when `pathname` matches `/mappings/` followed by exactly two path segments. Hidden for all other paths.
- "Mappings" remains clickable; clicking navigates to `/mappings` which collapses the sub-menu.
- Tab switches (`?tab=` change) do not collapse the sub-menu.

**Mobile nav:** Same pathname-driven sub-nav logic. Sub-menu is expanded by default on connector detail URLs. Sheet closes on navigate (standard shadcn Sheet `onOpenChange`).

### Failure Badge Data — Connector Stats Context

**Data source for failed job counts:**

`connectors:listConnectors` returns raw connector documents with no queue stats. Queue stats are provided by separate queries in `convex/mirror.ts`: `getSignalMirrorQueueStats` and `getSignalMirrorLatencyStats` (per-connector). A new Convex read-only query `connectors:getConnectorHealthSummary` is added. It returns an array of `{ tenantKey, connectorId, failedJobs, pendingJobs, totalJobs }` by joining connector documents with their queue stats. This is the second new backend function in this spec (alongside `listRecentJobsGlobal`).

**`ConnectorStatsContext`** is created at `context/connector-stats-context.tsx`:

```ts
type ConnectorHealth = {
  tenantKey: string;
  connectorId: string;
  failedJobs: number;
  pendingJobs: number;
  totalJobs: number;
};

type ConnectorStatsContextValue = {
  connectorHealth: ConnectorHealth[];
  // key format: `${tenantKey}::${connectorId}` (double-colon separator — neither segment contains "::")
  failedJobsByConnector: Record<string, number>;
};
```

The double-colon separator (`::`) is safe because tenant keys and connector IDs are alphanumeric with underscores only (no `:`). The context provider is added to `app/(workspace)/layout.tsx` and runs a single `useQuery(api.connectors.getConnectorHealthSummary)`.

### Visual Design

**Primary accent:** Shift from cyan → indigo/violet
- Primary: `#6366f1` (indigo-500)
- Primary light: `#a5b4fc` (indigo-300)
- Primary muted: `rgba(99, 102, 241, 0.15)` (for active nav backgrounds)

**Status colours (unchanged):**
- Active/healthy: `#22d3ee` (cyan-400)
- Success: `#22c55e` (green-500)
- Error/failed: `#ef4444` (red-500)
- Warning/pending: `#f59e0b` (amber-500)

**Backgrounds:**
- Page background: `#060b14`
- Sidebar background: `#0a0f1a`
- Card/surface background: `#111827`

**Typography:** No font change. Improve hierarchy with uppercase section labels, weight-600 headings, `rgba(255,255,255,0.4)` for secondary text.

---

## Section 2: Dashboard Home Page

**Route:** `/`
**File:** `app/(workspace)/page.tsx`

### Layout (top to bottom)

1. Stat cards row
2. Connector health table
3. Quick links row
4. Recent activity section

### Stat Cards (row 1)

Data source: `ConnectorStatsContext` (already provided at layout level — no additional query).

| Card | Value | Click behaviour |
|------|-------|----------------|
| Active connectors | N active / M total | → `/mappings` |
| Failed jobs | N failed across all connectors | → `/mappings/[tenantKey]/[connectorId]?tab=jobs` for the **first** connector in `connectorHealth` array with `failedJobs > 0`; if N = 0, card is not clickable |
| Pending jobs | N pending | — |
| Total routes | N configured | — |

The "first connector with failures" tiebreak is by array order from the server (no secondary sort required).

### Connector Health Table (row 2)

Columns: Health dot · Tenant · Connector · Status · Mirroring · Failed jobs · Last seen · Open

**Health dot colour (strict precedence, first rule wins):**
1. **Red** — `failedJobs > 0`
2. **Amber** — `status !== "active"` and `failedJobs === 0`
3. **Green** — `status === "active"` and `failedJobs === 0`

- Failed jobs cell: red badge if > 0, empty if 0
- Last seen: relative time ("2 mins ago")
- **Open link:** `/mappings/[tenantKey]/[connectorId]?tab=jobs` if `failedJobs > 0`, otherwise `/mappings/[tenantKey]/[connectorId]?tab=overview`. This same rule applies on the Connectors List page (Section 4). In both places, the Overview case explicitly includes `?tab=overview`.

### Quick Links (row 3)

Rendered in `app/(workspace)/page.tsx`. Open state for the token sheet is local to this component.

- **Create token** → opens `<ConnectorTokenSheet>` (Tenant and Connector ID fields blank — user fills them in)
- **Manage customers** → `/shop/customers`
- **View statistics** → `/shop/statistics`

### Recent Activity (row 4)

- Last 10 mirror jobs across all connectors
- Columns: Time · Event · Connector · Route · Status · Attempts
- Each row has a "View →" link → `/mappings/[tenantKey]/[connectorId]?tab=jobs`
- No retry button
- **Data source:** New Convex read-only query `connectors:listRecentJobsGlobal(limit: number)`.

**`listRecentJobsGlobal` return shape:**
```ts
Array<{
  _id: Id<"signalMirrorJobs">;
  updatedAt: number;           // ms timestamp
  eventType: "CREATE" | "UPDATE" | "DELETE";
  tenantKey: string;
  connectorId: string;
  sourceChannelId: string;     // for Route display
  targetChannelId: string;     // for Route display
  status: "completed" | "failed" | "processing" | "pending";
  attempts: number;
}>
```

---

## Section 3: Connector Detail Page — Tabbed Layout

**Route:** `/mappings/[tenantKey]/[connectorId]`

Tab navigation rendered below page header. Active tab controlled by `?tab=` query param (valid values: `overview`, `routes`, `jobs`, `settings`). Absent or unrecognised `?tab=` silently defaults to `overview`.

### Connector Workspace Component Refactor

`components/mappings/connector-workspace.tsx` becomes a thin shell:
- Owns all Convex `useQuery` calls for connector data
- Renders page header and status bar
- Reads `?tab=` from `useSearchParams()`
- Renders the appropriate tab component, passing fetched data as props
- Tab components do not fetch data independently

### Overview Tab (default)

**Status bar:** badges (`status: active`, `mirroring: enabled`, `config: vN`) + quick action buttons (Toggle status · Rotate token · Disable mirroring). These buttons are convenience duplicates of the authoritative Settings tab controls. Both call the same mutations. Rotate token button here opens `<ConnectorTokenSheet>` with `tenantKey` and `connectorId` **pre-filled and read-only**.

**Stat cards (2):**
- Queue stats: pending / failed (red if > 0) / total — from existing `getSignalMirrorQueueStats`
- Latency (last 60m): create p95 · update p95 · delete p95 — from existing `getSignalMirrorLatencyStats`

**Mirror runtime section:** bot token configured · dedicated token in use · role-sync fallback (all existing data)

**Seat configs by guild table:** Guild · Status · Seats · Seat policy · Checked · Error · Actions (Edit/Delete)

### Routes Tab

Add route button (top right) · source→target routes table · unconfigured seat snapshots collapsible (this tab only, not on Overview)

### Jobs Tab

Filters (event type · status · clear) · failed jobs pinned top with red left border when filter is ALL · jobs table (Updated · Event · Route · Status · Attempts · Images · Last error · Retry button)

### Settings Tab

Authoritative location for all control actions.

**Token management:** masked token display · Rotate token button (confirmation dialog → calls existing rotate mutation → refreshes; the button here opens `<ConnectorTokenSheet>` with `tenantKey` and `connectorId` pre-filled and read-only, same as the Overview shortcut)

**Mirroring:** enable/disable toggle

**Danger zone:** toggle active/inactive

---

## Section 4: Individual Page Improvements

### Connectors List (`/mappings`)

- Page title: "Connectors"
- "Configure" → "Open"
- Open link: `?tab=jobs` if `failedJobs > 0`, else `?tab=overview`
- Health dot first column (red → amber → green)
- "Failed jobs" column (red badge or empty)
- "Last seen" as relative time
- Token form removed; replaced with "Create / Rotate Token" button → opens `<ConnectorTokenSheet>` with fields blank

**`ConnectorTokenSheet` (`components/admin/connector-token-sheet.tsx`):**
- Fields: Tenant (text) · Connector ID (text) — may be pre-filled and read-only when called from the connector detail page
- Submit: "Create / Rotate"
- Success: close sheet + refresh connector list
- Error: inline error, sheet stays open
- Cancel / Escape: close without action

### Filtering Page (`/filtering`)

- **Connector selector:** single grouped Combobox (searchable), options grouped by tenant as `tenantKey / connectorId`; changing selection resets route dropdown and clears unsaved edits
- **Rule display:** current saved rules shown as read-only chips above edit fields
- **Tag inputs:** four fields replacing textareas; Enter or comma adds tag (trimmed, lowercased); × removes; duplicates silently ignored; no UI max length/count

### Customers Page (`/shop/customers`)

- Full-width search bar, auto-focused
- Status badge per result: `active` (green) · `expired` (red) · `none` (grey); tier + expiration as secondary text
- Expanded actions panel: two-column (info left, actions right)

### Shop Pages (Catalog, Policies, Statistics)

**Shared:** consistent `AdminSectionCard` usage; uppercase label + weight-600 title headers

**Catalog:** shared improvements only, no page-specific changes

**Statistics:**
- Data source: `sellStats:getSellStatsOverview` is a Convex **action** (not a query) and must be called with `useAction`. It is not reactive — the component calls it via `useAction` and re-invokes manually when the period selection changes.
- Metric cards row (8 metrics), period selector (7/30/90 days) in page header actions, default **30 days**, stored in local React state; changing period calls the action again with the new period; all cards and tables reflect the selected period.

**Policies:** tier badges colour-coded: `basic` (slate) · `pro` (indigo) · `advanced` (violet); improved table row separation

---

## Backend Functions Added (read-only, no schema changes)

| Function | Location | Purpose |
|----------|----------|---------|
| `getConnectorHealthSummary` | `convex/connectors.ts` | Returns per-connector failed/pending/total job counts for context |
| `listRecentJobsGlobal` | `convex/connectors.ts` | Returns last N mirror jobs across all connectors for dashboard |

---

## File Impact Summary

| File | Change type |
|------|------------|
| `app/globals.css` | Update CSS variables / colour tokens |
| `lib/adminRoutes.ts` | Extend type system; add `CONNECTOR_SUB_NAV_TABS`; update `getAdminNavState` and `buildAdminBreadcrumbs` |
| `context/connector-stats-context.tsx` | New — `ConnectorStatsContext` provider and hook |
| `app/(workspace)/layout.tsx` | Add `ConnectorStatsContext` provider |
| `components/admin/admin-sidebar.tsx` | New group structure (Connectors/Discord/Shop), contextual sub-nav, failure badge from context |
| `components/admin/admin-mobile-nav.tsx` | Same group structure + contextual sub-nav; sheet closes on navigate |
| `app/(workspace)/page.tsx` | New dashboard home page |
| `app/(workspace)/mappings/page.tsx` | Rename, health dots, conditional Open link, token sheet trigger |
| `app/(workspace)/mappings/[tenantKey]/[connectorId]/page.tsx` | Tabbed layout shell |
| `components/mappings/connector-workspace.tsx` | Thin shell: data fetching + tab routing |
| `components/mappings/connector-overview-tab.tsx` | New |
| `components/mappings/connector-routes-tab.tsx` | New |
| `components/mappings/connector-jobs-tab.tsx` | New |
| `components/mappings/connector-settings-tab.tsx` | New |
| `components/admin/connector-token-sheet.tsx` | New — token creation/rotation sheet |
| `app/(workspace)/filtering/page.tsx` | Combobox selector, tag inputs, rule display |
| `app/(workspace)/shop/catalog/page.tsx` | Shared layout improvements only |
| `app/(workspace)/shop/customers/page.tsx` | Status badges, two-column action panel |
| `app/(workspace)/shop/statistics/page.tsx` | `useAction`, metric cards, period selector |
| `app/(workspace)/shop/policies/page.tsx` | Tier badge colours, table styling |
| `components/ui/tag-input.tsx` | New |
| `convex/connectors.ts` | Add `getConnectorHealthSummary` and `listRecentJobsGlobal` |

---

## Out of Scope

- Schema changes or new mutations
- Authentication or access control changes
- Mobile-first redesign (mobile nav updated but not redesigned)
- New features beyond what currently exists
