export type SubscriptionTier = "basic" | "advanced" | "pro";

export type CatalogVariant = {
  _id: string;
  tier: SubscriptionTier;
  durationDays: number;
  displayPrice: string;
  priceSuffix: string | null;
  checkoutUrl: string;
  highlights: string[];
  isFeatured: boolean;
  active: boolean;
};

export type CatalogTier = {
  tier: SubscriptionTier;
  title: string;
  subtitle: string | null;
  badge: string | null;
  description: string | null;
  variants: CatalogVariant[];
};

export type CatalogQueryResult = {
  tiers: CatalogTier[];
};

export type ViewerRow = {
  userId: string;
  email: string | null;
  name: string | null;
  tier: SubscriptionTier | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  subscriptionEndsAt: number | null;
  hasSignalAccess: boolean;
};
