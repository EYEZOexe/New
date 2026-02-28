import type { CatalogError, PolicyScope } from "./types";

export function formatCatalogError(error: CatalogError): string {
  return `${error.code}: ${error.message}`;
}

export function normalizeStorefrontUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function parseProductIdFromPolicyExternalId(externalId: string): number | null {
  const [idPart] = externalId.split("|");
  const parsed = Number.parseInt((idPart ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseProductSlugFromPolicyExternalId(externalId: string): string | null {
  const [, slugPart] = externalId.split("|");
  const slug = (slugPart ?? "").trim();
  return slug.length > 0 ? slug : null;
}

export function parseDisplayPriceToCents(displayPrice: string): number | null {
  const normalized = displayPrice.trim().replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function splitPolicyExternalIdForCheckout(externalId: string): {
  matchExternalId: string;
  checkoutHint: string;
} {
  const [first, ...rest] = externalId.split("|");
  return {
    matchExternalId: (first ?? "").trim(),
    checkoutHint: rest.join("|").trim(),
  };
}

function buildStorefrontCheckoutUrl(origin: string, checkoutToken: string): string | null {
  if (!checkoutToken) return null;

  if (checkoutToken.startsWith("https://")) {
    return checkoutToken;
  }
  if (checkoutToken.startsWith("/")) {
    return `${origin}${checkoutToken}`;
  }
  if (checkoutToken.includes("/")) {
    return `${origin}/${checkoutToken.replace(/^\/+/, "")}`;
  }

  // Sell storefront product links are slug-based, not numeric ID-based.
  if (/^\d+$/.test(checkoutToken)) {
    return null;
  }
  return `${origin}/product/${encodeURIComponent(checkoutToken)}`;
}

export function buildAutoCheckoutUrl(args: {
  storefrontUrl: string;
  policyScope: PolicyScope;
  policyExternalId: string;
}): string | null {
  const origin = normalizeStorefrontUrl(args.storefrontUrl);
  const parsed = splitPolicyExternalIdForCheckout(args.policyExternalId.trim());
  if (!origin || !parsed.matchExternalId) return null;
  if (args.policyScope !== "product") return null;

  const checkoutToken = parsed.checkoutHint || parsed.matchExternalId;
  return buildStorefrontCheckoutUrl(origin, checkoutToken);
}

export function formatPolicyOptionValue(scope: PolicyScope, externalId: string): string {
  return `${scope}::${externalId}`;
}

export function parsePolicyOptionValue(
  value: string,
): { scope: PolicyScope; externalId: string } | null {
  const [scope, ...rest] = value.split("::");
  if ((scope !== "product" && scope !== "variant") || rest.length === 0) return null;
  const externalId = rest.join("::").trim();
  if (!externalId) return null;
  return { scope, externalId };
}
