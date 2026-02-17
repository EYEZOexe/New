import type { Id } from "./_generated/dataModel";

export type ShopCatalogErrorCode =
  | "invalid_checkout_url"
  | "duplicate_tier_duration_variant"
  | "policy_link_required"
  | "policy_link_disabled"
  | "title_required"
  | "display_price_required"
  | "policy_external_id_required"
  | "duration_days_invalid"
  | "variant_not_found";

export type ShopCatalogErrorShape = {
  code: ShopCatalogErrorCode;
  message: string;
};

export class ShopCatalogValidationError extends Error {
  readonly code: ShopCatalogErrorCode;

  constructor(code: ShopCatalogErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ShopCatalogValidationError";
  }
}

function shopError(code: ShopCatalogErrorCode, message: string): never {
  throw new ShopCatalogValidationError(code, message);
}

export function throwShopCatalogError(
  code: ShopCatalogErrorCode,
  message: string,
): never {
  return shopError(code, message);
}

export function asShopCatalogErrorShape(error: unknown): ShopCatalogErrorShape {
  if (error instanceof ShopCatalogValidationError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: "policy_link_required",
      message: error.message || "Unexpected shop catalog error.",
    };
  }

  return {
    code: "policy_link_required",
    message: "Unexpected shop catalog error.",
  };
}

export function assertValidCheckoutUrl(checkoutUrl: string): string {
  const value = checkoutUrl.trim();
  if (!value) {
    shopError("invalid_checkout_url", "Checkout URL is required.");
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      shopError(
        "invalid_checkout_url",
        "Checkout URL must use https://.",
      );
    }
  } catch {
    shopError("invalid_checkout_url", "Checkout URL is invalid.");
  }

  return value;
}

export function assertValidDurationDays(durationDays: number): number {
  if (
    !Number.isFinite(durationDays) ||
    !Number.isInteger(durationDays) ||
    durationDays <= 0
  ) {
    shopError(
      "duration_days_invalid",
      "Duration days must be a positive integer.",
    );
  }
  return durationDays;
}

export function assertUniqueTierDuration(
  variants: Array<{ _id: string | Id<"shopVariants">; tier: string; durationDays: number }>,
  args: {
    tier: string;
    durationDays: number;
    excludeVariantId?: string | Id<"shopVariants">;
  },
): void {
  const duplicate = variants.find(
    (variant) =>
      variant.tier === args.tier &&
      variant.durationDays === args.durationDays &&
      String(variant._id) !== String(args.excludeVariantId ?? ""),
  );
  if (duplicate) {
    shopError(
      "duplicate_tier_duration_variant",
      `Variant already exists for tier=${args.tier} and duration=${args.durationDays}.`,
    );
  }
}

export function assertLinkedPolicyEnabled(
  policy: { enabled: boolean } | null,
): void {
  if (!policy) {
    shopError(
      "policy_link_required",
      "A linked Sell access policy is required.",
    );
  }
  if (!policy.enabled) {
    shopError(
      "policy_link_disabled",
      "Linked Sell access policy must be enabled before publish.",
    );
  }
}
