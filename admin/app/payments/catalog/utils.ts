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

export function buildAutoCheckoutUrl(args: {
  storefrontUrl: string;
  policyScope: PolicyScope;
  policyExternalId: string;
}): string | null {
  const origin = normalizeStorefrontUrl(args.storefrontUrl);
  const policyExternalId = args.policyExternalId.trim();
  if (!origin || !policyExternalId) return null;
  if (args.policyScope !== "product") return null;
  if (policyExternalId.startsWith("https://")) {
    return policyExternalId;
  }
  if (policyExternalId.startsWith("/")) {
    return `${origin}${policyExternalId}`;
  }
  if (policyExternalId.includes("/")) {
    return `${origin}/${policyExternalId.replace(/^\/+/, "")}`;
  }
  return `${origin}/product/${encodeURIComponent(policyExternalId)}`;
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
