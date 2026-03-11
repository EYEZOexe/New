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

The existing `canceled` and `past_due` statuses already surface as failure. The main gap is `inactive`, which now gets a reason attached.

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
- `"subscription_inactive"` — webhook processed but subscription is inactive for other reasons (partial payment, access policy issue, etc.)
- Both fields cleared to `undefined` when a payment successfully activates the subscription

### Viewer Query (`convex/users.ts`)

Add to the return value:

```typescript
lastPaymentOutcome: subscription?.lastPaymentOutcome ?? null,
lastPaymentOutcomeAt: subscription?.lastPaymentOutcomeAt ?? null,
```

## Webhook Processor (`convex/payments.ts`)

When the subscription upsert runs after event processing, set `lastPaymentOutcome` based on the resolved state:

- **Trial blocked** (`repeatTrialDetected` → `effectiveSubscriptionStatus` downgraded to `"inactive"`): set `lastPaymentOutcome: "trial_already_claimed"`, `lastPaymentOutcomeAt: args.attemptedAt`
- **Other inactive outcomes** (`effectiveSubscriptionStatus !== "active"` and not trial-blocked): set `lastPaymentOutcome: "subscription_inactive"`, `lastPaymentOutcomeAt: args.attemptedAt`
- **Successful activation** (`effectiveSubscriptionStatus === "active"`): clear both — `lastPaymentOutcome: undefined`, `lastPaymentOutcomeAt: undefined`

No new mutations needed — these are additional fields in the existing subscription upsert patch.

## Checkout Return Page (`website/app/checkout/return/page.tsx`)

### ViewerRow Type

Add to the local `ViewerRow` type:

```typescript
lastPaymentOutcome: "trial_already_claimed" | "subscription_inactive" | null;
lastPaymentOutcomeAt: number | null;
```

### Status Determination

```typescript
const status: "pending" | "success" | "failure" = (() => {
  if (!isAuthenticated || !viewer) return "pending";
  if (viewer.hasSignalAccess) return "success";
  if (viewer.subscriptionStatus === "canceled" || viewer.subscriptionStatus === "past_due") return "failure";
  if (viewer.lastPaymentOutcome) return "failure"; // webhook ran, result not active
  return "pending";
})();
```

### Failure Message Copy

Replace the single generic "Activation incomplete" alert with reason-specific copy:

| Condition | Title | Description |
|---|---|---|
| `lastPaymentOutcome === "trial_already_claimed"` | Free trial already used | A free trial has already been claimed on this account. Purchase a paid plan to get access. |
| `lastPaymentOutcome === "subscription_inactive"` | Purchase not completed | Your payment wasn't confirmed. If you completed checkout, contact support with your order ID. |
| `subscriptionStatus === "canceled"` | Payment cancelled | Your order didn't go through. Head back to pricing to try again. |
| `subscriptionStatus === "past_due"` | Payment failed | We couldn't process your payment. Try again with a different method. |
| fallback | Activation incomplete | (existing copy, kept as safety net) |

### Timeout Message Improvement

The 90s `processingTimedOut` amber warning is now a fallback for cases where no webhook arrived at all. Replace the misleading "Payment was received" copy with context-aware messages:

- If `viewer?.subscriptionStatus === null`: "No payment confirmation received. Your checkout may not have completed — check your email or try again."
- Otherwise: "Order detected but access hasn't activated. Try refreshing — if the problem persists, contact support with your order ID."

### No Changes

- Auto-redirect behavior unchanged (10s to `/shop` on failure, 8s to `/dashboard` on success)
- All button/action copy unchanged
- Status details card unchanged

## Files Changed

| File | Change |
|---|---|
| `convex/schema.ts` | Add `lastPaymentOutcome`, `lastPaymentOutcomeAt` to subscriptions table |
| `convex/payments.ts` | Set/clear `lastPaymentOutcome` + `lastPaymentOutcomeAt` in subscription upsert |
| `convex/users.ts` | Expose `lastPaymentOutcome`, `lastPaymentOutcomeAt` from viewer query |
| `website/app/checkout/return/page.tsx` | Update `ViewerRow` type, status logic, failure copy, timeout copy |
