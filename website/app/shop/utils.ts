import type { SubscriptionTier } from "./types";

export function buildCheckoutUrl(
  baseUrl: string,
  tier: SubscriptionTier,
  durationDays: number,
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("source", "website_shop");
    url.searchParams.set("tier", tier);
    url.searchParams.set("duration_days", String(durationDays));
    return url.toString();
  } catch {
    return baseUrl;
  }
}
