# Shop + Admin Redesign Design

**Date:** 2026-02-17

## Context

The current `website` and `admin` surfaces are functionally working but visually basic and not optimized for conversion or operator efficiency.

Business requirements for the next phase:

- Upgrade both apps to a premium, presentable, "smart" UI.
- Add a proper `website` shop page so customers can buy Sell.app plans.
- Let operators manage tier + duration variants with display pricing and checkout links in `admin`.
- Keep access enforcement authoritative in Convex payment policies.
- Add tier-gated dashboard signal visibility (website only) so message visibility depends on subscription tier.
- Preserve fast delivery targets and remove wasteful high-frequency claim polling in worker loops.

## Confirmed Product Decisions

- Shop purchase UX: **tier-first**, then duration variant.
- Source of truth for shop merchandising: **admin-managed Convex catalog**.
- Checkout launch: **external Sell checkout URL per variant**.
- Realtime: **full realtime** across admin catalog, website shop, checkout-return, and dashboard entitlement state.
- Price rendering: **admin-entered display price labels**.
- Visual direction: **premium finance clean** (light, trust-forward, strong hierarchy).
- Variant model: **per-tier durations** (not global shared durations).
- First release scope: website `home + shop + dashboard` and admin `home + payments/policies`.
- Dashboard content gating default: **hidden until explicitly configured**.

## Goals

- Improve presentation quality and trust on website/admin.
- Ship a conversion-focused shop tied safely to entitlement policies.
- Keep policy enforcement and merchandising concerns separated.
- Support tier-gated dashboard feed visibility by mapping/channel rules.
- Replace aggressive fixed-interval worker claim calls with event-driven wakeups + bounded fallback.

## Non-Goals

- Changing Discord mirror entitlement behavior for customer guilds.
- Replacing Sell checkout with a custom payment provider flow.
- Reworking existing webhook semantics beyond required integration points.

## Architecture

### 1) Keep Enforcement and Catalog Separate

Maintain `sellAccessPolicies` as the sole entitlement policy source for payment->access resolution.

Add a dedicated shop catalog domain for presentation:

- `shopTiers`
  - `tier` (`basic|advanced|pro`)
  - `title`, `subtitle`, `badge`, `description`
  - `sortOrder`, `active`, `updatedAt`
- `shopVariants`
  - `tier`, `durationDays`
  - `displayPrice`, `priceSuffix`
  - `checkoutUrl`
  - `highlights[]`
  - `isFeatured`, `sortOrder`, `active`
  - `policyScope`, `policyExternalId` (link to `sellAccessPolicies`)
  - `updatedAt`

Publish guard: a variant cannot be activated unless linked policy exists and is enabled.

### 2) Tier-Gated Dashboard Visibility (Website Only)

Extend connector mapping/source visibility metadata for website dashboard filtering:

- `dashboardEnabled: boolean`
- `minimumTier: "basic" | "advanced" | "pro"`

`signals:listRecent` remains access-gated by active subscription and then applies tier-based visibility filtering by channel mapping rules.

Behavior:

- Unconfigured mapping defaults to hidden.
- `basic` users see only rules with `minimumTier=basic`.
- `advanced` users see `basic + advanced`.
- `pro` users see all enabled tiers.

### 3) Realtime Data Flow

- Admin catalog/mapping updates use Convex mutations.
- Website shop uses live Convex query for published catalog.
- Checkout return route uses live viewer/subscription state to switch from pending -> active.
- Dashboard feed and visibility rule changes update live.

### 4) Worker Efficiency: Event-Driven Wakeups

Problem observed: claim mutations are called too frequently (e.g., every 5ms), creating avoidable backend noise.

Design:

- Introduce a queue wake-state query that reflects:
  - ready counts for mirror and role-sync jobs
  - next due timestamps for delayed retries
  - server time snapshot
- Bot uses Convex realtime subscription (`onUpdate`) to this wake state.
- Worker loop wakes immediately on relevant updates and drains jobs.
- Keep bounded fallback timer only as safety when websocket state is degraded.
- Remove fixed ultra-low `setInterval` claim loops.

Outcome:

- Event-driven behavior on new work.
- Near-immediate processing preserved.
- Massive reduction in empty claim spam.

## UX Design (Phase 1 Scope)

### Website

- `Home`: premium trust-forward hero, value blocks, clear CTA to shop.
- `Shop`: tier-first cards with per-tier duration chips/rows and direct checkout buttons.
- `Checkout return`: explicit pending/success/failure states driven by realtime entitlement.
- `Dashboard`: cleaner hierarchy, subscription summary, locked-content hints, tier-gated feed.

### Admin

- `Home`: cleaner navigation/status cards.
- `Payments/Policies`: policy-link health indicators; clearer editing flow.
- Catalog management surface:
  - manage tier cards
  - manage per-tier variants
  - validate policy linkage before publish
- Connector mapping surface:
  - add dashboard visibility + minimum tier controls
  - make hidden-vs-visible state obvious.

## Validation Rules

- `durationDays` must be positive integer.
- `displayPrice` non-empty.
- `checkoutUrl` must be valid `https://`.
- no duplicate duration variants in same tier (unless explicitly supported later).
- active variants require active linked policy.
- dashboard visibility requires explicit enabled rule and tier value.

## Error Handling

- Return consistent typed errors from Convex mutations:
  - `policy_link_required`
  - `policy_link_disabled`
  - `invalid_checkout_url`
  - `duplicate_tier_duration_variant`
  - `dashboard_visibility_not_configured`
- Dashboard query returns empty list with structured gating reason when no visible mappings are eligible.

## Observability

- Admin logs:
  - catalog create/update/publish
  - policy-link validation result
  - mapping visibility updates
- Website logs:
  - shop catalog counts by tier
  - checkout return state transitions
  - dashboard tier + filtered vs returned counts
- Worker logs:
  - wake source (`realtime_update` vs `fallback_tick`)
  - claim attempts with non-empty/empty outcomes
  - queue delay + mirror latency metrics

## Performance Targets

- Keep mirror posting path aligned with strict low-latency target.
- Practical objective: maintain sub-50ms enqueue->claim pickup when queue and websocket are healthy.
- Remove high-frequency empty claims that inflate mutation traffic and noise.

## Rollout Plan

1. Add schema + Convex APIs for catalog and dashboard visibility.
2. Build admin catalog/visibility controls.
3. Build website home/shop/dashboard redesign and checkout-return flow.
4. Ship worker wakeup redesign behind config flag and verify latency.
5. Enable by default after monitoring confirms low pickup latency and reduced empty claims.

