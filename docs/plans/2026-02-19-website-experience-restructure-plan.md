# Website Experience Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade website IA and UX with a real dashboard route, cleaner auth/shop separation, wider layout usage, and a functional trading journal.

**Architecture:** Keep Convex as the single backend source while consolidating member navigation around `/dashboard` + `/workspace/*`, widening the shared frame for desktop usage, and adding computed journal analytics on top of persisted journal trades.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Convex React client/server functions, Recharts, Bun tests/typecheck/build.

---

## Completed Tasks

- [x] Replace `/dashboard` redirect with real dashboard page rendered inside shared workspace shell. (2026-02-19)
- [x] Normalize workspace navigation to use `/dashboard` as canonical overview route while keeping `/workspace/overview` compatibility redirect behavior. (2026-02-19)
- [x] Widen site frame (`site-wrap`) and improve desktop spacing to use available viewport space. (2026-02-19)
- [x] Refine login/signup pages with redirect-aware auth flow and clearer route-specific information architecture. (2026-02-19)
- [x] Refine shop hero/cards and responsive tier grid structure for clearer shopping UX. (2026-02-19)
- [x] Make journal analytics functional: profit factor, expectancy, best trade, max drawdown, equity curve, and date-aware P&L calendar. (2026-02-19)
- [x] Harden journal validation/persistence for closed-trade requirements and P&L computation fallback in Convex mutation. (2026-02-19)
- [x] Add/adjust tests for workspace routes, trade schema rules, and journal analytics adapter behavior. (2026-02-19)
- [x] Execute second-pass workspace module polish for visual consistency and interaction quality (`live-intel` timeframe filtering, `indicators`/`strategies` empty states, and improved card affordances). (2026-02-19)
- [x] Run Convex env sync from `website/.env.example` for non-placeholder runtime variables via CLI (excluding deployment-managed/built-in keys). (2026-02-19)
- [x] Push Convex backend updates using `convex dev --once` from `website` with `.env.example` deployment env context. (2026-02-19)
- [x] Run post-deploy workspace function smoke checks (`listMarketSnapshots`, `listStrategies`, `listNewsArticles`) confirming callable responses, with CLI post-exit assertion caveat on current Windows/Bun runtime. (2026-02-19)
- [x] Complete professional SaaS layout polish for `shop`, `login`, and `signup` page composition (hierarchy, spacing rhythm, and card internals). (2026-02-19)
- [x] Rebuild all non-dashboard customer pages from scratch (`/`, `/shop`, `/login`, `/signup`, `/checkout/return`) using dedicated marketing layout components and customer-facing copy only. (2026-02-19)

## Verification Evidence

- `cd website && bun test tests/workspaceAdapters.test.js tests/tradeFormSchema.test.js tests/workspaceRoutes.test.js` (pass)
- `cd website && bun run typecheck` (pass)
- `cd website && bun run build` (pass)
- Convex env sync command executed from `website`:
  - `bunx convex env --env-file .env.example set <KEY> <VALUE>` loop over non-placeholder keys (pass)
- Convex deploy command executed from `website`:
  - `bunx convex dev --once --env-file .env.example` (pass)
- Convex smoke checks executed from `website`:
  - `convex run workspace:listMarketSnapshots {"limit":1}` returned `[]` (callable)
  - `convex run workspace:listStrategies {"activeOnly":true,"limit":1}` returned `[]` (callable)
  - `convex run workspace:listNewsArticles {"limit":1}` returned `[]` (callable)
  - Note: CLI currently exits with `uv` assertion after output on this Windows/Bun runtime.
- Customer-page redesign verification executed from `website`:
  - `bun run typecheck` (pass)
  - `bun run build` (pass)
