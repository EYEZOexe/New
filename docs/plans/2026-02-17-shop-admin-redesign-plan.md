# Shop + Admin Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a premium website/admin redesign with a realtime tier-first shop, tier-gated dashboard signal visibility, and event-driven worker wakeups to eliminate high-frequency empty claim spam.

**Architecture:** Keep payment/access enforcement in existing `sellAccessPolicies` and `payments` flows, and add a separate shop catalog domain for presentation. Add explicit dashboard visibility rules per mapping/channel and apply them in `signals:listRecent`. Replace fixed-interval worker claim loops with realtime queue wake subscriptions and bounded fallback timers.

**Tech Stack:** Convex functions/schema, Next.js (`website`, `admin`), Bun tests, Discord bot worker (`Discord-Bot`), TypeScript.

---

### Task 1: Add tier visibility primitives with tests

**Files:**
- Create: `convex/tierVisibility.ts`
- Test: `website/tests/tierVisibility.test.js`

**Step 1: Write the failing tests**

```js
import { describe, expect, it } from "bun:test";
import {
  isTierAtLeast,
  filterVisibleChannelIdsForTier,
} from "../../convex/tierVisibility";

describe("tier visibility", () => {
  it("orders tiers basic < advanced < pro", () => {
    expect(isTierAtLeast("advanced", "basic")).toBe(true);
    expect(isTierAtLeast("basic", "advanced")).toBe(false);
  });

  it("hides channels unless explicitly dashboard enabled", () => {
    const visible = filterVisibleChannelIdsForTier("advanced", [
      { channelId: "c1", dashboardEnabled: false, minimumTier: "basic" },
      { channelId: "c2", dashboardEnabled: true, minimumTier: "pro" },
      { channelId: "c3", dashboardEnabled: true, minimumTier: "basic" },
    ]);
    expect(visible).toEqual(["c3"]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd website && bun test tests/tierVisibility.test.js`
Expected: FAIL due to missing module/functions.

**Step 3: Write minimal implementation**

```ts
export type SubscriptionTier = "basic" | "advanced" | "pro";

const ORDER: SubscriptionTier[] = ["basic", "advanced", "pro"];

export function isTierAtLeast(
  current: SubscriptionTier | null,
  minimum: SubscriptionTier,
): boolean {
  if (!current) return false;
  return ORDER.indexOf(current) >= ORDER.indexOf(minimum);
}
```

**Step 4: Re-run tests**

Run: `cd website && bun test tests/tierVisibility.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/tierVisibility.ts website/tests/tierVisibility.test.js
git commit -m "feat: add tier visibility primitives for dashboard gating"
```

### Task 2: Add schema fields for shop catalog and dashboard visibility

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add new tables and fields**

Add:
- `shopTiers`
- `shopVariants`
- `dashboardEnabled` and `minimumTier` to `connectorMappings`.

Example snippet:

```ts
dashboardEnabled: v.optional(v.boolean()),
minimumTier: v.optional(
  v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
),
```

**Step 2: Run typecheck**

Run: `cd website && bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add shop catalog tables and dashboard visibility fields"
```

### Task 3: Build Convex shop catalog APIs with policy-link validation

**Files:**
- Create: `convex/shopCatalog.ts`
- Create: `convex/shopCatalogUtils.ts`
- Test: `website/tests/shopCatalogUtils.test.js`

**Step 1: Write failing validator tests**

Cover:
- invalid `checkoutUrl`
- duplicate tier+duration rejection
- missing/disabled linked policy rejection.

**Step 2: Run tests**

Run: `cd website && bun test tests/shopCatalogUtils.test.js`
Expected: FAIL.

**Step 3: Implement utilities + Convex handlers**

Add helpers in `convex/shopCatalogUtils.ts`:
- `assertValidCheckoutUrl`
- `assertUniqueTierDuration`
- `assertLinkedPolicyEnabled`

Add in `convex/shopCatalog.ts`:
- `listPublicShopCatalog`
- `listAdminShopCatalog`
- `upsertShopTier`
- `upsertShopVariant`
- `removeShopVariant`
- `setShopVariantActive`

**Step 4: Re-run tests + typecheck**

Run:
- `cd website && bun test tests/shopCatalogUtils.test.js`
- `cd website && bun run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/shopCatalog.ts convex/shopCatalogUtils.ts website/tests/shopCatalogUtils.test.js
git commit -m "feat: add shop catalog API with strict policy link validation"
```

### Task 4: Implement tier-gated signal query and mapping controls

**Files:**
- Modify: `convex/signals.ts`
- Modify: `convex/connectors.ts`
- Modify: `admin/app/connectors/[tenantKey]/[connectorId]/page.tsx`
- Test: `website/tests/tierVisibility.test.js`

**Step 1: Extend mapping upsert payload**

In `connectors:upsertMapping`, accept and persist:
- `dashboardEnabled`
- `minimumTier`

**Step 2: Filter `signals:listRecent` by viewer tier + mapping rules**

Use `filterVisibleChannelIdsForTier` before returning rows.

**Step 3: Update admin mapping UI**

Add controls:
- dashboard visible toggle
- minimum tier select
- badges in mappings table.

**Step 4: Verify**

Run:
- `cd website && bun test tests/tierVisibility.test.js`
- `cd admin && bun run typecheck`
- `cd website && bun run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/signals.ts convex/connectors.ts admin/app/connectors/[tenantKey]/[connectorId]/page.tsx website/tests/tierVisibility.test.js
git commit -m "feat: gate dashboard signals by tier and mapping visibility"
```

### Task 5: Build admin catalog management and redesign key admin pages

**Files:**
- Modify: `admin/app/page.tsx`
- Modify: `admin/app/payments/policies/page.tsx`
- Create: `admin/app/payments/catalog/page.tsx`
- Modify: `admin/app/globals.css`

**Step 1: Implement premium-finance visual system**

Add CSS tokens and page-level design primitives (cards, spacing, hierarchy, subtle gradients).

**Step 2: Add catalog management surface**

Add tier + variant CRUD form blocks with realtime list updates and validation messages.

**Step 3: Integrate navigation**

Add `Catalog` route links from admin home and payment pages.

**Step 4: Verify**

Run:
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/app/page.tsx admin/app/payments/policies/page.tsx admin/app/payments/catalog/page.tsx admin/app/globals.css
git commit -m "feat(admin): redesign surfaces and add realtime catalog management"
```

### Task 6: Build website redesign with shop and checkout-return flow

**Files:**
- Modify: `website/app/page.tsx`
- Create: `website/app/shop/page.tsx`
- Create: `website/app/checkout/return/page.tsx`
- Modify: `website/app/dashboard/page.tsx`
- Modify: `website/app/globals.css`

**Step 1: Build new home and shop UI**

Implement:
- premium hero/value blocks on home
- tier-first catalog rendering on shop
- duration variant selector per tier
- external checkout CTA.

**Step 2: Add checkout return realtime state**

Render pending/success/failure based on live viewer subscription and tier data.

**Step 3: Update dashboard messaging**

Show lock/upgrade hints when tier-gated channels are unavailable.

**Step 4: Verify**

Run:
- `cd website && bun run typecheck`
- `cd website && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add website/app/page.tsx website/app/shop/page.tsx website/app/checkout/return/page.tsx website/app/dashboard/page.tsx website/app/globals.css
git commit -m "feat(website): redesign home/shop/dashboard and add checkout return flow"
```

### Task 7: Replace fixed poll loops with event-driven worker wakeups

**Files:**
- Create: `convex/workerQueueWake.ts`
- Modify: `convex/mirrorQueue.ts`
- Modify: `convex/roleSyncQueue.ts`
- Modify: `Discord-Bot/src/index.ts`
- Create: `Discord-Bot/src/queueWakeClient.ts`
- Modify: `Discord-Bot/src/config.ts`
- Modify: `Discord-Bot/.env.example`
- Test: `Discord-Bot/tests/queueWakeScheduler.test.ts`

**Step 1: Write failing scheduler tests**

Cover:
- immediate wake on ready jobs
- delayed wake using next due timestamp
- fallback wake when subscription disconnected.

**Step 2: Run tests**

Run: `cd Discord-Bot && bun test tests/queueWakeScheduler.test.ts`
Expected: FAIL.

**Step 3: Add wake-state query + enqueue notifications**

Implement query returning:
- `mirror.pendingReady`
- `mirror.nextRunAfter`
- `role.pendingReady`
- `role.nextRunAfter`
- `serverNow`

Update enqueue/requeue paths to bump wake state atomically.

**Step 4: Rewrite bot loop**

Replace `setInterval`-driven claims with:
- realtime `ConvexClient.onUpdate` wake notifications
- single-flight drain loop
- bounded fallback timer (e.g., 250-1000ms jittered).

**Step 5: Re-run tests and typecheck**

Run:
- `cd Discord-Bot && bun test tests/queueWakeScheduler.test.ts`
- `cd Discord-Bot && bun run typecheck`
Expected: PASS.

**Step 6: Commit**

```bash
git add convex/workerQueueWake.ts convex/mirrorQueue.ts convex/roleSyncQueue.ts Discord-Bot/src/index.ts Discord-Bot/src/queueWakeClient.ts Discord-Bot/src/config.ts Discord-Bot/.env.example Discord-Bot/tests/queueWakeScheduler.test.ts
git commit -m "feat(bot): move queue claims to event-driven wakeups with fallback"
```

### Task 8: Instrumentation, verification, and roadmap/docs sync

**Files:**
- Modify: `convex/signals.ts`
- Modify: `Discord-Bot/src/index.ts`
- Modify: `docs/roadmap.md`
- Modify: `docs/plans/2026-02-17-shop-admin-redesign-design.md` (if implementation deltas appear)

**Step 1: Add logs**

Add structured logs for:
- tier-filtered signal counts
- catalog publish validation outcomes
- worker wake source and empty/non-empty claims.

**Step 2: Run full verification**

Run:
- `cd website && bun test`
- `cd website && bun run typecheck`
- `cd website && bun run build`
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
- `cd Discord-Bot && bun run typecheck`
- `cd Discord-Bot && bun run build`

Expected: PASS across all commands.

**Step 3: Update roadmap**

Record:
- completed milestone entries with dates
- current status (`Now/Next/Blockers`)
- links to design/plan docs.

**Step 4: Commit**

```bash
git add convex/signals.ts Discord-Bot/src/index.ts docs/roadmap.md docs/plans/2026-02-17-shop-admin-redesign-design.md
git commit -m "chore: add observability, verification, and roadmap updates for redesign rollout"
```

