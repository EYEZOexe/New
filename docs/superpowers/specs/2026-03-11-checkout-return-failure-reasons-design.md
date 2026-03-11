# Checkout Return Page: Failure Reason Improvements

**Date:** 2026-03-11
**Status:** Approved

## Problem

The checkout return page (`/checkout/return`) has three gaps:

1. **Trial blocking is silent.** When a free trial is blocked (`trial_already_claimed`), the subscription ends up `inactive`. The page treats `inactive` as "pending" and spins indefinitely, then after 90s shows a generic "Taking longer than expected" message — never explaining the real reason.

2. **`cancelled`/`inactive` lack specific copy.** The failure state shows a single generic "Activation incomplete" message regardless of whether the payment was cancelled, failed, or otherwise not completed.

3. **The 90s timeout message is misleading.** It says "Payment was received" when the webhook may never have arrived at all.

## Approach

**Backend:** Store the outcome reason on the subscription record whenever a webhook processes with a non-active result. Expose it through the viewer query.

**Frontend:** Use the outcome reason to show specific, actionable failure messages immediately — no waiting for the 90s timeout.

The existing `canceled` and `past_due` statuses already surface as failure on the checkout page. The main gap is `inactive`, which now gets a reason attached.

## Data Layer

### Schema (`convex/schema.ts`)

Add two optional fields to the `subscriptions` table:

```typescript
lastPaymentOutcome: v.optional(v.union(
  v.literal("trial_already_claimed"),
  v.literal("subscription_inactive"),
)),
lastPaymentOutcomeAt: v.optional(v.number()),
```

- `"trial_already_claimed"` — free trial blocked due to repeat trial detection
- `"subscription_inactive"` — webhook processed but subscription is `inactive` for non-trial reasons (partial payment, access policy issue, etc.)
- Both fields are cleared to `undefined` (not `null`) when a payment successfully activates the subscription. Convex removes optional fields when patched to `undefined`; `null` is not valid here since the schema does not include `v.null()`.
- `lastPaymentOutcomeAt` is internal data; it is stored for debugging/auditing purposes but **not exposed** in the viewer query.

### Viewer Query (`convex/users.ts`) — source of truth

**This file must be updated before the frontend type.** The local `ViewerRow` type in `page.tsx` mirrors what the viewer query returns; adding the field to the page type without adding it to the query will result in the field always being `undefined` at runtime.

Add one field to the return value:

```typescript
lastPaymentOutcome: subscription?.lastPaymentOutcome ?? null,
```

Do **not** add `lastPaymentOutcomeAt` to the viewer return — it is not needed by the frontend.

## Webhook Processor (`convex/payments.ts`)

### `upsertSubscriptionForUser` — add `lastPaymentOutcome` arg

Add an optional `lastPaymentOutcome` arg to `upsertSubscriptionForUser`:

```typescript
args: {
  // ... existing args ...
  lastPaymentOutcome?: "trial_already_claimed" | "subscription_inactive" | undefined;
}
```

In the `next` object constructed inside the function, include:

```typescript
lastPaymentOutcome: args.lastPaymentOutcome,       // undefined clears the field
lastPaymentOutcomeAt: args.lastPaymentOutcome ? args.now : undefined,
```

When `args.lastPaymentOutcome` is `undefined` (i.e., active subscription), both fields are patched to `undefined`, clearing them from the record.

### Trial-blocked path (lines 760–807)

The `repeatTrialDetected` block returns early at line 801 **without calling** `upsertSubscriptionForUser`. This is the most important path for `trial_already_claimed` and requires explicit handling.

After the existing `ctx.db.patch(event._id, ...)` call (line 784) and before the `return`, call `upsertSubscriptionForUser` with `status: "inactive"` and `lastPaymentOutcome: "trial_already_claimed"`:

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

This either inserts a new subscription record (if none exists) or patches the existing one with `lastPaymentOutcome: "trial_already_claimed"`.

### Normal processing path (line 810)

Pass `lastPaymentOutcome` when calling `upsertSubscriptionForUser`:

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
    effectiveSubscriptionStatus === "inactive"
      ? "subscription_inactive"
      : undefined, // undefined clears the field on active/canceled/past_due
});
```

**Scoping note:** Only write `"subscription_inactive"` when `effectiveSubscriptionStatus === "inactive"`. Do not write it for `"canceled"` or `"past_due"` — those are already handled on the frontend via `subscriptionStatus`. Writing `"subscription_inactive"` for those statuses would be misleading noise on the record.

## Checkout Return Page (`website/app/checkout/return/page.tsx`)

### `ViewerRow` Type

Add one field (after `convex/users.ts` is updated):

```typescript
lastPaymentOutcome: "trial_already_claimed" | "subscription_inactive" | null;
```

### Status Determination

```typescript
const status: "pending" | "success" | "failure" = (() => {
  if (!isAuthenticated || !viewer) return "pending";
  if (viewer.hasSignalAccess) return "success";
  if (viewer.subscriptionStatus === "canceled" || viewer.subscriptionStatus === "past_due") return "failure";
  if (viewer.lastPaymentOutcome) return "failure"; // webhook ran, outcome not active
  return "pending";
})();
```

**Intentional behavior:** `subscriptionStatus === "inactive"` with `lastPaymentOutcome === null` remains `"pending"`. This covers the case where a user has a prior inactive subscription and is waiting for a new order's webhook to arrive — spinning is correct here since the outcome isn't known yet.

### Failure Message Copy

Replace the single generic "Activation incomplete" alert. Derive the failure reason from a helper at the top of the render:

```typescript
const failureReason: string | null =
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

Then replace the failure alert with reason-specific copy:

| `failureReason` | Title | Description |
|---|---|---|
| `"trial_already_claimed"` | Free trial already used | A free trial has already been claimed on this account. Purchase a paid plan to get access. |
| `"subscription_inactive"` | Purchase not completed | Your payment wasn't confirmed. If you completed checkout, contact support with your order ID. |
| `"canceled"` | Payment cancelled | Your order didn't go through. Redirecting back to pricing in {countdown}s. |
| `"past_due"` | Payment failed | We couldn't process your payment. Try again with a different method. |
| `null` (fallback) | Activation incomplete | (existing copy, kept as safety net) |

### Timeout Message Improvement

The 90s `processingTimedOut` amber warning is now a fallback for cases where no outcome has arrived. Replace the misleading "Payment was received" copy with context-aware messages:

- If `viewer` is loaded and `viewer.subscriptionStatus === null` (meaning no subscription row exists at all — the viewer query returns `subscription?.status ?? null`, so null = no subscription record): "No payment confirmation received. Your checkout may not have completed — check your email or try again."
- Otherwise (subscription exists but access not granted): "Order detected but access hasn't activated. Try refreshing — if the problem persists, contact support with your order ID."

### No Changes

- Auto-redirect behavior unchanged (10s to `/shop` on failure, 8s to `/dashboard` on success)
- All button/action copy unchanged
- Status details card unchanged

## Files Changed

| File | Change |
|---|---|
| `convex/schema.ts` | Add `lastPaymentOutcome`, `lastPaymentOutcomeAt` to subscriptions table |
| `convex/payments.ts` | Add `lastPaymentOutcome` arg to `upsertSubscriptionForUser`; set it in trial-blocked path and normal path |
| `convex/users.ts` | Expose `lastPaymentOutcome` (not `lastPaymentOutcomeAt`) from viewer query |
| `website/app/checkout/return/page.tsx` | Update `ViewerRow` type, status logic, `failureReason` helper, failure copy, timeout copy |

## Implementation Order

1. `convex/schema.ts` — schema must exist before mutations write to it
2. `convex/payments.ts` — add `lastPaymentOutcome` to `upsertSubscriptionForUser` and both call sites
3. `convex/users.ts` — expose in viewer (source of truth for frontend type)
4. `website/app/checkout/return/page.tsx` — update type and UI last
