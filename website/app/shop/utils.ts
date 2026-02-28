import type { SubscriptionTier } from "./types";

export type CheckoutLaunchMode = "opened" | "blocked";

const CHECKOUT_RETURN_PATH = "/checkout/return";

function normalizeCheckoutEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function normalizeCheckoutPortalUrl(checkoutUrl: string | null | undefined): string | null {
  if (!checkoutUrl) return null;
  try {
    const parsed = new URL(checkoutUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
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

type BuildCheckoutStatusUrlArgs = {
  tier: SubscriptionTier;
  durationDays: number;
  launch: CheckoutLaunchMode;
  checkoutUrl?: string | null;
};

export function buildCheckoutStatusUrl(args: BuildCheckoutStatusUrlArgs): string {
  const params = new URLSearchParams();
  params.set("tier", args.tier);
  params.set("duration_days", String(args.durationDays));
  params.set("launch", args.launch);
  const normalizedCheckoutUrl = normalizeCheckoutPortalUrl(args.checkoutUrl);
  if (normalizedCheckoutUrl) {
    params.set("checkout_url", normalizedCheckoutUrl);
  }
  return `${CHECKOUT_RETURN_PATH}?${params.toString()}`;
}
