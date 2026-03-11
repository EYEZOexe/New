# Checkout Return Failure Reasons Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface specific failure reasons (trial already claimed, payment not completed, etc.) on the checkout return page instead of a generic "Activation incomplete" message or a 90-second timeout.

**Architecture:** Add `lastPaymentOutcome` to the subscriptions DB record, set it in the webhook processor when a payment resolves to a non-active state, expose it through the viewer query, and use it on the checkout return page to immediately show specific failure copy.

**Tech Stack:** Convex (schema, mutations, queries), Next.js 16 / React 19, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-checkout-return-failure-reasons-design.md`

---

## Chunk 1: Backend — Schema, Payments Processor, Viewer Query

### Task 1: Add `lastPaymentOutcome` fields to subscriptions schema

**Files:**
- Modify: `convex/schema.ts` (subscriptions table definition, around line 147)

**Context:** The subscriptions table is defined with `defineTable({...})`. The new fields must be added as `v.optional(...)` so they can be cleared by patching to `undefined`. Convex removes optional fields when patched to `undefined`.

- [ ] **Step 1.1: Add the two new optional fields to the subscriptions table**

Open `convex/schema.ts`. Find the `subscriptions: defineTable({` block (around line 147). After the `updatedAt: v.number()` field (last field in the table, around line 166), add:

```typescript
    lastPaymentOutcome: v.optional(
      v.union(v.literal("trial_already_claimed"), v.literal("subscription_inactive")),
    ),
    lastPaymentOutcomeAt: v.optional(v.number()),
```

The full subscriptions table should now end with:
```typescript
    updatedAt: v.number(),
    lastPaymentOutcome: v.optional(
      v.union(v.literal("trial_already_claimed"), v.literal("subscription_inactive")),
    ),
    lastPaymentOutcomeAt: v.optional(v.number()),
  })
```

- [ ] **Step 1.2: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to the schema change. (There may be pre-existing unrelated errors — those are fine.)

- [ ] **Step 1.3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add lastPaymentOutcome fields to subscriptions schema"
```

---

### Task 2: Add `lastPaymentOutcome` to `upsertSubscriptionForUser`

**Files:**
- Modify: `convex/payments.ts` — `upsertSubscriptionForUser` function (lines 485–561)

**Context:** `upsertSubscriptionForUser` builds a `next` object and either inserts a new subscription or patches the existing one. We need to pass `lastPaymentOutcome` through from the caller. When the value is `undefined`, patching with it clears the field from the record.

The function signature currently is:
```typescript
async function upsertSubscriptionForUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    status: SubscriptionStatus;
    productId: string | null;
    variantId: string | null;
    tier: SubscriptionTier | null;
    durationDays: number | null;
    now: number;
  },
```

- [ ] **Step 2.1: Add `lastPaymentOutcome` to the function's `args` type**

In the `args` object of `upsertSubscriptionForUser`, add after `now: number;`:

```typescript
    lastPaymentOutcome?: "trial_already_claimed" | "subscription_inactive" | undefined;
```

- [ ] **Step 2.2: Include `lastPaymentOutcome` and `lastPaymentOutcomeAt` in the `next` object**

Find the `next` object inside `upsertSubscriptionForUser` (around line 533). It currently ends with `updatedAt: args.now`. Add two new fields after `updatedAt`:

```typescript
    lastPaymentOutcome: args.lastPaymentOutcome,
    lastPaymentOutcomeAt: args.lastPaymentOutcome !== undefined ? args.now : undefined,
```

When `args.lastPaymentOutcome` is `undefined` (i.e., active subscription path), both fields patch to `undefined`, which removes them from the Convex record.

- [ ] **Step 2.3: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors from the function signature change.

- [ ] **Step 2.4: Commit**

```bash
git add convex/payments.ts
git commit -m "feat: add lastPaymentOutcome arg to upsertSubscriptionForUser"
```

---

### Task 3: Set `lastPaymentOutcome` in the webhook processor — normal path

**Files:**
- Modify: `convex/payments.ts` — `processSellWebhookEvent` call to `upsertSubscriptionForUser` (around line 810)

**Context:** The normal (non-trial-blocked) call site is at line 810. After this change, it passes `lastPaymentOutcome: "subscription_inactive"` only when `effectiveSubscriptionStatus === "inactive"`. For `active`, `canceled`, and `past_due`, it passes `undefined` (clearing the field). The `canceled` and `past_due` cases are already shown as failure on the frontend, so no outcome code is needed for them.

- [ ] **Step 3.1: Add `lastPaymentOutcome` to the normal call site**

Find the `upsertSubscriptionForUser` call around line 810:
```typescript
      const subscription = await upsertSubscriptionForUser(ctx, {
        userId: resolvedUser.id,
        status: effectiveSubscriptionStatus,
        productId: projected.productId,
        variantId: projected.variantId,
        tier: accessPolicy?.tier ?? null,
        durationDays: accessPolicy?.durationDays ?? null,
        now: args.attemptedAt,
      });
```

Add `lastPaymentOutcome` as the last argument before the closing `}`:
```typescript
      const subscription = await upsertSubscriptionForUser(ctx, {
        userId: resolvedUser.id,
        status: effectiveSubscriptionStatus,
        productId: projected.productId,
        variantId: projected.variantId,
        tier: accessPolicy?.tier ?? null,
        durationDays: accessPolicy?.durationDays ?? null,
        now: args.attemptedAt,
        lastPaymentOutcome:
          effectiveSubscriptionStatus === "inactive" ? "subscription_inactive" : undefined,
      });
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

- [ ] **Step 3.3: Commit**

```bash
git add convex/payments.ts
git commit -m "feat: set lastPaymentOutcome=subscription_inactive on inactive webhook outcomes"
```

---

### Task 4: Set `lastPaymentOutcome` in the webhook processor — trial-blocked path

**Files:**
- Modify: `convex/payments.ts` — `repeatTrialDetected` block (lines 760–807)

**Context:** When `repeatTrialDetected` is true, the function returns early at line 801 WITHOUT calling `upsertSubscriptionForUser`. The subscription record may or may not exist. We must call `upsertSubscriptionForUser` with `status: "inactive"` and `lastPaymentOutcome: "trial_already_claimed"` in this block so the outcome is recorded.

The insertion point is: after the `ctx.db.patch(event._id, ...)` call at line 784 and before the `return { ok: true ... }` at line 801.

Current structure of the block (condensed):
```typescript
if (repeatTrialDetected) {
  if (!existingTrialLock) { await persistTrialLocks(...) }
  await upsertPaymentCustomerTracking(...)
  await ctx.db.patch(event._id, { ..., resolvedVia: "trial_already_claimed", ... })
  console.warn(...)
  return { ok: true, deduped: false, subscriptionStatus: "inactive", userId: resolvedUser.id }
}
```

- [ ] **Step 4.1: Add `upsertSubscriptionForUser` call inside the `repeatTrialDetected` block**

After the `ctx.db.patch(event._id, {...})` call (around line 784) and before `console.warn(...)`, add:

```typescript
          await upsertSubscriptionForUser(ctx, {
            userId: resolvedUser.id,
            status: "inactive",
            productId: projected.productId,
            variantId: projected.variantId,
            tier: null,
            durationDays: null,
            now: args.attemptedAt,
            lastPaymentOutcome: "trial_already_claimed",
          });
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

- [ ] **Step 4.3: Commit**

```bash
git add convex/payments.ts
git commit -m "feat: set lastPaymentOutcome=trial_already_claimed in repeat trial blocked path"
```

---

### Task 5: Expose `lastPaymentOutcome` in the viewer query

**Files:**
- Modify: `convex/users.ts` — `viewer` query handler (lines 7–43)

**Context:** The viewer query already reads the `subscription` row. It returns the subscription fields needed by the frontend. We add `lastPaymentOutcome` to the return object. We do NOT add `lastPaymentOutcomeAt` — that is internal data only.

The current return object ends with `hasConsumedTrial: Boolean(trialLock)`.

- [ ] **Step 5.1: Add `lastPaymentOutcome` to the viewer return**

In `convex/users.ts`, find the return object inside the `viewer` handler (around line 32). After `hasConsumedTrial: Boolean(trialLock),`, add:

```typescript
      lastPaymentOutcome: subscription?.lastPaymentOutcome ?? null,
```

The full return should now be:
```typescript
    return {
      userId,
      email: typeof user.email === "string" ? user.email : null,
      name: typeof user.name === "string" ? user.name : null,
      tier: subscription?.tier ?? null,
      subscriptionStatus: subscription?.status ?? null,
      subscriptionEndsAt: subscription?.endsAt ?? null,
      hasSignalAccess: hasActiveSubscriptionAccess(subscription, now),
      hasConsumedTrial: Boolean(trialLock),
      lastPaymentOutcome: subscription?.lastPaymentOutcome ?? null,
    };
```

- [ ] **Step 5.2: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors from the viewer change. TypeScript infers the return type from the object literal, so the frontend type update (Task 6) must match what this now returns.

- [ ] **Step 5.3: Commit**

```bash
git add convex/users.ts
git commit -m "feat: expose lastPaymentOutcome in viewer query"
```

---

## Chunk 2: Frontend — Checkout Return Page

### Task 6: Update `ViewerRow` type and status determination logic

**Files:**
- Modify: `website/app/checkout/return/page.tsx` (lines 20–104)

**Context:** The page has a local `ViewerRow` type that mirrors what the viewer query returns. It also has a `status` IIFE that determines whether the page shows pending/success/failure. Both need updating.

The current `ViewerRow` type (lines 20–26):
```typescript
type ViewerRow = {
  userId: string;
  tier: SubscriptionTier | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  subscriptionEndsAt: number | null;
  hasSignalAccess: boolean;
};
```

The current status IIFE (lines 97–104):
```typescript
const status: "pending" | "success" | "failure" = (() => {
  if (!isAuthenticated || !viewer) return "pending";
  if (viewer.hasSignalAccess) return "success";
  if (viewer.subscriptionStatus === "canceled" || viewer.subscriptionStatus === "past_due") {
    return "failure";
  }
  return "pending";
})();
```

- [ ] **Step 6.1: Add `lastPaymentOutcome` to `ViewerRow`**

In `page.tsx`, add `lastPaymentOutcome` to the `ViewerRow` type:

```typescript
type ViewerRow = {
  userId: string;
  tier: SubscriptionTier | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  subscriptionEndsAt: number | null;
  hasSignalAccess: boolean;
  lastPaymentOutcome: "trial_already_claimed" | "subscription_inactive" | null;
};
```

- [ ] **Step 6.2: Update the status IIFE to treat `lastPaymentOutcome` as failure**

Replace the existing status IIFE with:

```typescript
const status: "pending" | "success" | "failure" = (() => {
  if (!isAuthenticated || !viewer) return "pending";
  if (viewer.hasSignalAccess) return "success";
  if (viewer.subscriptionStatus === "canceled" || viewer.subscriptionStatus === "past_due") {
    return "failure";
  }
  if (viewer.lastPaymentOutcome) return "failure";
  return "pending";
})();
```

- [ ] **Step 6.3: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new type errors. If you see errors about `lastPaymentOutcome` not existing on the viewer type, ensure `convex/users.ts` was updated first (Task 5) and that the generated Convex types are up to date.

- [ ] **Step 6.4: Commit**

```bash
git add website/app/checkout/return/page.tsx
git commit -m "feat: add lastPaymentOutcome to ViewerRow type and status detection"
```

---

### Task 7: Replace generic failure alert with reason-specific copy

**Files:**
- Modify: `website/app/checkout/return/page.tsx` (around lines 232–241, failure alert section)

**Context:** The current failure alert (lines 232–241) is a single block:
```tsx
{status === "failure" ? (
  <Alert variant="destructive">
    <XCircle className="size-4" />
    <AlertTitle>Activation incomplete</AlertTitle>
    <AlertDescription>
      We could not activate access yet. Redirecting back to pricing in{" "}
      {redirectCountdown ?? FAILURE_REDIRECT_SECONDS}s.
    </AlertDescription>
  </Alert>
) : null}
```

We replace this with reason-specific copy driven by a `failureReason` derived value.

- [ ] **Step 7.1: Add a `failureReason` derived value**

Immediately after the `status` IIFE (and before the `redirectTarget` / `redirectSeconds` lines), add:

```typescript
const failureReason =
  status !== "failure"
    ? null
    : viewer?.lastPaymentOutcome === "trial_already_claimed"
      ? "trial_already_claimed"
      : viewer?.lastPaymentOutcome === "subscription_inactive"
        ? "subscription_inactive"
        : viewer?.subscriptionStatus === "canceled"
          ? "canceled"
          : viewer?.subscriptionStatus === "past_due"
            ? "past_due"
            : null;
```

- [ ] **Step 7.2: Replace the failure alert with reason-specific copy**

Replace the entire failure alert block (lines 232–241) with:

```tsx
{status === "failure" ? (
  <Alert variant="destructive">
    <XCircle className="size-4" />
    <AlertTitle>
      {failureReason === "trial_already_claimed"
        ? "Free trial already used"
        : failureReason === "subscription_inactive"
          ? "Purchase not completed"
          : failureReason === "canceled"
            ? "Payment cancelled"
            : failureReason === "past_due"
              ? "Payment failed"
              : "Activation incomplete"}
    </AlertTitle>
    <AlertDescription>
      {failureReason === "trial_already_claimed"
        ? "A free trial has already been claimed on this account. Purchase a paid plan to get access."
        : failureReason === "subscription_inactive"
          ? "Your payment wasn't confirmed. If you completed checkout, contact support with your order ID."
          : failureReason === "canceled"
            ? `Your order didn't go through. Redirecting back to pricing in ${redirectCountdown ?? FAILURE_REDIRECT_SECONDS}s.`
            : failureReason === "past_due"
              ? `We couldn't process your payment. Try again with a different method. Redirecting in ${redirectCountdown ?? FAILURE_REDIRECT_SECONDS}s.`
              : `We could not activate access yet. Redirecting back to pricing in ${redirectCountdown ?? FAILURE_REDIRECT_SECONDS}s.`}
    </AlertDescription>
  </Alert>
) : null}
```

- [ ] **Step 7.3: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

- [ ] **Step 7.4: Commit**

```bash
git add website/app/checkout/return/page.tsx
git commit -m "feat: show reason-specific failure copy on checkout return page"
```

---

### Task 8: Improve the 90-second timeout message

**Files:**
- Modify: `website/app/checkout/return/page.tsx` (around lines 200–209, `processingTimedOut` alert)

**Context:** The current 90s timeout alert (lines 200–209):
```tsx
{status === "pending" && processingTimedOut ? (
  <Alert className="border-amber-400/40 bg-amber-500/10">
    <Clock3 className="size-4 text-amber-300" />
    <AlertTitle className="text-amber-200">Taking longer than expected</AlertTitle>
    <AlertDescription className="text-amber-100/90">
      Payment was received (order {sellOrderId}) but access hasn&apos;t activated yet.
      Try refreshing — if the problem persists, contact support with your order ID.
    </AlertDescription>
  </Alert>
) : null}
```

The copy "Payment was received" is misleading — the webhook may never have arrived. Replace with two context-aware variants based on whether a subscription record exists (`viewer?.subscriptionStatus === null` means no subscription row at all).

- [ ] **Step 8.1: Replace the timeout alert copy**

Replace the `processingTimedOut` alert block with:

```tsx
{status === "pending" && processingTimedOut ? (
  <Alert className="border-amber-400/40 bg-amber-500/10">
    <Clock3 className="size-4 text-amber-300" />
    <AlertTitle className="text-amber-200">Taking longer than expected</AlertTitle>
    <AlertDescription className="text-amber-100/90">
      {viewer?.subscriptionStatus === null
        ? "No payment confirmation received. Your checkout may not have completed — check your email or try again."
        : `Order ${sellOrderId ? `(${sellOrderId}) ` : ""}detected but access hasn&apos;t activated. Try refreshing — if the problem persists, contact support with your order ID.`}
    </AlertDescription>
  </Alert>
) : null}
```

Note: `\u2019` is the right single quotation mark (') used to avoid JSX apostrophe escaping issues.

- [ ] **Step 8.2: Verify TypeScript compiles**

```bash
cd website && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

- [ ] **Step 8.3: Commit**

```bash
git add website/app/checkout/return/page.tsx
git commit -m "feat: improve checkout timeout message with context-aware copy"
```

---

## Manual Testing Checklist

After deploying to dev/staging (`npx convex dev` + `npm run dev`):

**Trial already claimed:**
1. Create a test account and complete a free trial checkout
2. On the same account (or matching email/IP), attempt another free trial
3. Confirm: checkout return page immediately shows "Free trial already used" instead of spinning

**Payment cancelled / past due:**
4. Use Sellapp's test mode to simulate a cancelled order
5. Confirm: checkout return page shows "Payment cancelled" with redirect countdown

**Normal successful checkout:**
6. Complete a normal paid checkout
7. Confirm: page shows "Access is active" and redirects to dashboard — no regression

**Timeout message:**
8. Load `/checkout/return?order_id=TEST123` without completing a checkout
9. Wait 90 seconds
10. With no subscription: confirm "No payment confirmation received" message
11. With prior inactive subscription: confirm the "Order detected but access hasn't activated" message
