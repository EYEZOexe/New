# Admin Workspace Refactor Design

**Date:** 2026-02-17

## Context

The current `admin` UI is functionally complete but fragmented:

- Page-specific headers and nav links are duplicated across routes.
- Layout and visual hierarchy vary by page and reduce operator speed.
- Domain ownership is unclear (mappings, Discord operations, and shop operations are spread across unrelated route structures).

The target is a full workspace rewrite that keeps all Convex-backed functionality intact while replacing the admin information architecture with a coherent sidebar-driven system.

## Confirmed Decisions

- Approach: full domain workspace rewrite (not just shell-only cleanup).
- Route policy: route changes are allowed if functionality is preserved and legacy routes remain safely reachable via redirects.
- Navigation model: route-based shell (not single-page tabs).
- Sidebar top-level: `Mappings`, `Discord Bot`, `Shop`.
- Default entry route: `Mappings`.
- Mobile behavior: sidebar collapses into a drawer/sheet.

## Goals

- Preserve all current admin capabilities without backend contract changes.
- Remove redundant page chrome, repeated action bars, and disjointed styling.
- Centralize navigation and shared layout primitives.
- Improve operator UX for frequent workflows (connector operations first).

## Non-Goals

- No changes to Convex mutation/query names, payloads, or authorization behavior.
- No changes to website customer-facing routes or flows.
- No replacement of existing business logic for mappings, policies, catalog, or payment customer lookup.

## New Information Architecture

### Primary Routes

- `/` -> redirect to `/mappings`
- `/mappings`
- `/mappings/[tenantKey]/[connectorId]`
- `/discord-bot`
- `/shop/catalog`
- `/shop/policies`
- `/shop/customers`

### Sidebar Structure

- `Mappings`
- `Discord Bot`
- `Shop`
- `Catalog` (nested under `Shop`)
- `Access Policies` (nested under `Shop`)
- `Payment Customers` (nested under `Shop`)

## Layout System

### Global Workspace Shell

- Persistent left sidebar on desktop.
- Mobile top bar with menu trigger for a drawer/sidebar.
- Shared content frame with sticky page header region.
- Route-aware active highlighting and section grouping in sidebar.

### Page Composition Standard

All pages adopt one structure:

1. `AdminPageHeader` (title, subtitle, breadcrumb, primary actions)
2. `AdminMetricStrip` (status chips or KPI cards where relevant)
3. `AdminSectionCard` blocks for forms and action groups
4. `AdminTableShell` for tabular data with consistent loading/empty/error states

## Domain Workspace Layouts

### Mappings

- `/mappings` is the default operator landing page.
- Focus on connector list, status, mirroring state, and direct navigation to connector workspace.
- `/mappings/[tenantKey]/[connectorId]` keeps all existing runtime controls and mapping tools:
  - connector status + token rotation
  - mirroring enable/disable
  - available channel management and discovery request
  - source->target mapping with dashboard visibility + minimum tier
  - mirror queue/latency + recent mirror jobs

### Discord Bot

- `/discord-bot` consolidates tier role mappings and role-sync runtime health.
- Keeps save/clear mapping behavior and runtime diagnostics exactly as-is.

### Shop

- `/shop/catalog`: catalog merchandising management (tiers + variants).
- `/shop/policies`: Sell policy mappings and durations.
- `/shop/customers`: searchable customer/subscription linkage for operations.

## Component Architecture

### Shared Components (`admin/components/admin/*`)

- `admin-shell.tsx`
- `admin-sidebar.tsx`
- `admin-mobile-nav.tsx`
- `admin-page-header.tsx`
- `admin-metric-strip.tsx`
- `admin-section-card.tsx`
- `admin-table-shell.tsx`
- `admin-status-badge.tsx`

### Domain Modules

- `admin/components/mappings/*`
- `admin/components/discord-bot/*`
- `admin/components/shop/*`

### Logic Boundaries

- Convex query/mutation orchestration remains in route-level hooks/modules.
- Shared components remain presentational and reusable.
- Repeated status/formatting logic is extracted into typed helpers.

## Redirect and Migration Strategy

- Keep legacy URLs reachable with safe redirects:
  - `/connectors` -> `/mappings`
  - `/connectors/[tenantKey]/[connectorId]` -> `/mappings/[tenantKey]/[connectorId]`
  - `/discord` -> `/discord-bot`
  - `/payments/catalog` -> `/shop/catalog`
  - `/payments/policies` -> `/shop/policies`
  - `/payments/customers` -> `/shop/customers`

This preserves bookmarks and external operator references while enabling cleaner route ownership.

## Error Handling and Observability

- Standardize inline feedback surfaces across pages (`success`, `error`, `loading`).
- Maintain existing console operational logs and normalize prefixes:
  - `[admin/mappings]`
  - `[admin/discord-bot]`
  - `[admin/shop]`
- Keep early-return route guards for missing params and not-found connector states.

## Verification Plan

- `cd admin && bun run typecheck`
- `cd admin && bun run build`
- Manual smoke checks:
  - mappings list + connector drilldown
  - token rotation + status/mirroring toggles
  - source/mapping create and remove actions
  - discord tier role save/clear
  - shop catalog/policies/customers functionality
  - legacy route redirect behavior

