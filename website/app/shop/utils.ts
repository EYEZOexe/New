import type { SubscriptionTier } from "./types";

function normalizeCheckoutEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function buildCheckoutUrl(
  baseUrl: string,
  tier: SubscriptionTier,
  durationDays: number,
  viewerEmail?: string | null,
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("source", "website_shop");
    url.searchParams.set("tier", tier);
    url.searchParams.set("duration_days", String(durationDays));
    const normalizedEmail = normalizeCheckoutEmail(viewerEmail);
    if (normalizedEmail) {
      url.searchParams.set("email", normalizedEmail);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}
