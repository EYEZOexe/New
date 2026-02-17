export type SubscriptionTier = "basic" | "advanced" | "pro";
export type PolicyScope = "product" | "variant";

export type CatalogError = {
  code: string;
  message: string;
};

export type CatalogVariant = {
  _id: string;
  tier: SubscriptionTier;
  durationDays: number;
  displayPrice: string;
  priceSuffix: string | null;
  checkoutUrl: string;
  highlights: string[];
  isFeatured: boolean;
  sortOrder: number | null;
  active: boolean;
  policyScope: PolicyScope;
  policyExternalId: string;
  updatedAt: number;
};

export type CatalogTier = {
  _id: string;
  tier: SubscriptionTier;
  title: string;
  subtitle: string | null;
  badge: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  updatedAt: number;
  variants: CatalogVariant[];
};

export type FlattenedCatalogVariant = CatalogVariant & {
  tierTitle: string;
};

export type CatalogQueryResult = {
  tiers: CatalogTier[];
};

export type PolicyRow = {
  scope: PolicyScope;
  externalId: string;
  tier: SubscriptionTier;
  durationDays: number | null;
  enabled: boolean;
  updatedAt: number;
};

export type UpsertTierResult =
  | { ok: true; tierId: string }
  | { ok: false; error: CatalogError };

export type UpsertVariantResult =
  | { ok: true; variantId: string }
  | { ok: false; error: CatalogError };

export type RemoveVariantResult =
  | { ok: true; removed: true }
  | { ok: false; error: CatalogError };

export type SetVariantActiveResult =
  | { ok: true; variantId: string; active: boolean }
  | { ok: false; error: CatalogError };
