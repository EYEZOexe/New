import type { Doc } from "./_generated/dataModel";

export type SubscriptionTier = "basic" | "advanced" | "pro";
export type BillingMode = "recurring" | "fixed_term";

export function hasActiveSubscriptionAccess(
  subscription:
    | Pick<Doc<"subscriptions">, "status" | "billingMode" | "endsAt">
    | null
    | undefined,
  now: number,
): boolean {
  if (!subscription || subscription.status !== "active") return false;

  if (subscription.billingMode === "fixed_term") {
    if (!subscription.endsAt || !Number.isFinite(subscription.endsAt)) return false;
    return subscription.endsAt > now;
  }

  return true;
}
