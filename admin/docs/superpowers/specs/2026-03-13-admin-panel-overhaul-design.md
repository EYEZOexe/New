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

### Contextual Sub-Nav

When navigating inside a connector detail page, the sidebar expands a sub-menu beneath "Mappings":

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

The connector name and tab links are derived from the current URL (`/mappings/[tenantKey]/[connectorId]`). The badge on Jobs shows the current failed job count from the connector's queue stats. Navigating away from the connector collapses the sub-menu.

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

**Typography:** No font change. Improve hierarchy with consistent use of uppercase section labels, weight-600 headings, and `rgba(255,255,255,0.4)` for secondary text.

---

## Section 2: Dashboard Home Page

**Route:** `/` (replace current redirect to `/mappings`)
**File:** `app/(workspace)/page.tsx`

### Layout

**Top row — 4 stat cards:**
| Card | Value | Click behaviour |
|------|-------|----------------|
| Active connectors | N active / M total | → /mappings |
| Failed jobs | N failed across all connectors | → connector with most failures |
| Pending jobs | N pending | — |
| Total routes | N configured | — |

**Middle section — Connector health table:**

Columns: Health dot · Tenant · Connector · Status · Mirroring · Failed jobs · Last seen · Open

- Health dot: green (0 failures, active), red (failures > 0 or inactive), amber (inactive but 0 failures)
- Failed jobs: shown in red if > 0
- Last seen: relative time ("2 mins ago")
- Open link: goes to Jobs tab if failures > 0, otherwise Overview tab

**Bottom section — Recent activity:**
- Last 10 mirror jobs across all connectors
- Columns: Time · Event · Connector · Route · Status · Attempts
- No retry button here (go to connector Jobs tab for that)

**Quick links row** (between health table and activity):
- Create connector token → opens token creation panel
- Manage customers → /shop/customers
- View statistics → /shop/statistics

---

## Section 3: Connector Detail Page — Tabbed Layout

**Route:** `/mappings/[tenantKey]/[connectorId]`
**Tabs:** Overview · Routes · Jobs · Settings

### Overview Tab (default)

**Status bar** (full width, below page header):
- Badges: `status: active`, `mirroring: enabled`, `config: vN`
- Action buttons inline: Toggle status · Rotate token · Disable mirroring

**Stat cards row (2 cards):**
- Queue stats: pending / failed (red if > 0) / total
- Latency (last 60m): create p95 · update p95 · delete p95

**Mirror runtime section:**
- Mirror bot token configured: yes/no
- Dedicated mirror token in use: yes/no
- Shared role-sync token fallback: yes/no

**Seat configs by guild table:**
- Columns: Guild · Status · Seats · Seat policy · Checked · Error · Actions (Edit/Delete)
- Unconfigured seat snapshots collapsible section

### Routes Tab

**Add route button** — prominent at the top right

**Configured source→target routes table:**
- Columns: Source (plugin) · Target (bot) · Role ping · Dashboard · Min tier · Priority · Actions (Edit/Remove)
- Full table, same as current but without being buried

**Unconfigured seat snapshots** collapsible section

### Jobs Tab

**Filters row:** Event type (ALL / CREATE / UPDATE / DELETE) · Status (ALL / completed / failed / processing) · clear filters

**Failed jobs** pinned to top of table with red row highlight when status filter is ALL

**Jobs table:**
- Columns: Updated · Event · Route · Status · Attempts · Images · Last error · Actions
- Expandable rows (already exists, keep)
- Retry button per row

### Settings Tab

**Token management section:**
- Current token info
- Rotate token button

**Mirroring section:**
- Enable/disable mirroring toggle

**Danger zone section:**
- Toggle connector active/inactive

---

## Section 4: Individual Page Improvements

### Connectors List (`/mappings`)

- Rename page title: "Connector Mappings" → "Connectors"
- Rename "Configure" link → "Open"
- Add health dot column (green/red/amber) as first column
- Add "Failed jobs" column (red badge, hidden if 0)
- "Last seen" displayed as relative time
- Token creation UI moves to a slide-out sheet panel (button in page header actions)

### Filtering Page (`/filtering`)

- Connector selector at the top (replaces current two-dropdown flow)
- Show current saved rules for the selected route before editing
- Replace raw textareas with tag-input fields: comma or Enter to add a tag, click × to remove
- Tags validated/normalised on input (trim whitespace, lowercase domains)

### Customers Page (`/shop/customers`)

- Search bar prominent at the top (full width)
- Customer result shows subscription status badge: `active` (green) · `expired` (red) · `none` (grey)
- Actions panel (grant/revoke, update email, reset password) in a two-column layout: info on left, actions on right
- Subscription details (tier, expiration) shown inline with the status badge

### Shop Pages (Catalog, Policies, Statistics)

**Shared improvements:**
- Consistent card-based section layout across all three
- Section headers with consistent typography

**Statistics:**
- Metric cards row at top (completed sales, revenue, renewals %, AOV, etc.)
- Charts and tables below
- Period selector (7/30/90 days) prominent at the top right

**Policies:**
- Tier badges colour-coded: basic (grey) · pro (indigo) · advanced (violet)
- Cleaner table row styling with better visual separation

---

## File Impact Summary

| File | Change type |
|------|------------|
| `app/globals.css` | Update CSS variables / colour tokens |
| `lib/adminRoutes.ts` | Add Dashboard route, rename items, add connector sub-nav logic |
| `components/admin/admin-sidebar.tsx` | Implement new groups + contextual sub-nav |
| `components/admin/admin-mobile-nav.tsx` | Mirror sidebar changes |
| `app/(workspace)/page.tsx` | New dashboard home page |
| `app/(workspace)/mappings/page.tsx` | Rename, richer table, health dots, slide-out token panel |
| `app/(workspace)/mappings/[tenantKey]/[connectorId]/page.tsx` | Tabbed layout shell |
| `components/mappings/connector-workspace.tsx` | Refactor into tab components |
| `app/(workspace)/filtering/page.tsx` | Tag inputs, improved connector selector |
| `app/(workspace)/shop/customers/page.tsx` | Improved layout, status badges |
| `app/(workspace)/shop/statistics/page.tsx` | Dashboard-style layout |
| `app/(workspace)/shop/policies/page.tsx` | Tier badge colours |
| `components/ui/tag-input.tsx` | New component for filtering page |

---

## Out of Scope

- Backend / Convex function changes (UI-only overhaul)
- Authentication or access control changes
- Mobile-first redesign (desktop-primary, mobile navigation improved but not a focus)
- New features beyond what currently exists
