import type { Doc } from "./_generated/dataModel";

export type SubscriptionTier = "basic" | "advanced" | "pro";

export function hasActiveSubscriptionAccess(
  subscription:
    | Pick<Doc<"subscriptions">, "status" | "endsAt">
    | null
    | undefined,
  now: number,
): boolean {
  if (!subscription || subscription.status !== "active") return false;
  if (!subscription.endsAt || !Number.isFinite(subscription.endsAt)) return false;
  return subscription.endsAt > now;
}
