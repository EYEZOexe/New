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

export function getTierTheme(tier: SubscriptionTier): string {
  if (tier === "basic") return "from-cyan-500/20 via-slate-900/70 to-slate-900/80";
  if (tier === "advanced") return "from-amber-500/20 via-slate-900/70 to-slate-900/80";
  return "from-fuchsia-500/20 via-slate-900/70 to-slate-900/80";
}
