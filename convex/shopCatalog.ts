import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  asShopCatalogErrorShape,
  assertLinkedPolicyEnabled,
  assertUniqueTierDuration,
  assertValidCheckoutUrl,
  assertValidDurationDays,
  throwShopCatalogError,
} from "./shopCatalogUtils";

type SubscriptionTier = "basic" | "advanced" | "pro";
type PolicyScope = "product" | "variant";

type ShopMutationResult<T extends Record<string, unknown>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: ReturnType<typeof asShopCatalogErrorShape>;
    };

const TIER_ORDER: SubscriptionTier[] = ["basic", "advanced", "pro"];

function tierRank(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

function normalizeRequired(
  value: string,
  args: { code: Parameters<typeof throwShopCatalogError>[0]; message: string },
): string {
  const normalized = value.trim();
  if (!normalized) {
    throwShopCatalogError(args.code, args.message);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeHighlights(highlights: string[] | undefined): string[] | undefined {
  if (!highlights || highlights.length === 0) return undefined;
  const values = highlights
    .map((highlight) => highlight.trim())
    .filter((highlight) => highlight.length > 0);
  return values.length > 0 ? values : undefined;
}

function mapVariant(row: Doc<"shopVariants">) {
  return {
    _id: row._id,
    tier: row.tier,
    durationDays: row.durationDays,
    displayPrice: row.displayPrice,
    priceSuffix: row.priceSuffix ?? null,
    checkoutUrl: row.checkoutUrl,
    highlights: row.highlights ?? [],
    isFeatured: row.isFeatured === true,
    sortOrder: row.sortOrder ?? null,
    active: row.active,
    policyScope: row.policyScope,
    policyExternalId: row.policyExternalId,
    updatedAt: row.updatedAt,
  };
}

function mapTier(row: Doc<"shopTiers">, variants: Doc<"shopVariants">[]) {
  return {
    _id: row._id,
    tier: row.tier,
    title: row.title,
    subtitle: row.subtitle ?? null,
    badge: row.badge ?? null,
    description: row.description ?? null,
    sortOrder: row.sortOrder,
    active: row.active,
    updatedAt: row.updatedAt,
    variants: variants.map(mapVariant),
  };
}

function sortTiers(rows: Doc<"shopTiers">[]): Doc<"shopTiers">[] {
  return [...rows].sort((a, b) => {
    const bySort = a.sortOrder - b.sortOrder;
    if (bySort !== 0) return bySort;
    return tierRank(a.tier) - tierRank(b.tier);
  });
}

function sortVariants(rows: Doc<"shopVariants">[]): Doc<"shopVariants">[] {
  return [...rows].sort((a, b) => {
    const byTier = tierRank(a.tier) - tierRank(b.tier);
    if (byTier !== 0) return byTier;
    const bySort = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
    if (bySort !== 0) return bySort;
    return a.durationDays - b.durationDays;
  });
}

async function getLinkedPolicy(
  ctx: QueryCtx | MutationCtx,
  policyScope: PolicyScope,
  policyExternalId: string,
) {
  return await ctx.db
    .query("sellAccessPolicies")
    .withIndex("by_scope_externalId", (q) =>
      q.eq("scope", policyScope).eq("externalId", policyExternalId),
    )
    .first();
}

export const listPublicShopCatalog = query({
  args: {},
  handler: async (ctx) => {
    const tiers = await ctx.db
      .query("shopTiers")
      .withIndex("by_active_sortOrder", (q) => q.eq("active", true))
      .collect();
    const variants = await ctx.db
      .query("shopVariants")
      .withIndex("by_active_tier_sortOrder", (q) => q.eq("active", true))
      .collect();

    const sortedTiers = sortTiers(tiers);
    const sortedVariants = sortVariants(variants);
    const variantsByTier = new Map<SubscriptionTier, Doc<"shopVariants">[]>();
    for (const variant of sortedVariants) {
      const current = variantsByTier.get(variant.tier) ?? [];
      current.push(variant);
      variantsByTier.set(variant.tier, current);
    }

    const catalog = sortedTiers.map((tier) =>
      mapTier(tier, variantsByTier.get(tier.tier) ?? []),
    );

    const variantCount = catalog.reduce(
      (total, tier) => total + tier.variants.length,
      0,
    );
    console.info(
      `[shop-catalog] public list tiers=${catalog.length} variants=${variantCount}`,
    );

    return { tiers: catalog };
  },
});

export const listAdminShopCatalog = query({
  args: {},
  handler: async (ctx) => {
    const tiers = await ctx.db.query("shopTiers").collect();
    const variants = await ctx.db.query("shopVariants").collect();

    const sortedTiers = sortTiers(tiers);
    const sortedVariants = sortVariants(variants);
    const variantsByTier = new Map<SubscriptionTier, Doc<"shopVariants">[]>();
    for (const variant of sortedVariants) {
      const current = variantsByTier.get(variant.tier) ?? [];
      current.push(variant);
      variantsByTier.set(variant.tier, current);
    }

    const catalog = sortedTiers.map((tier) =>
      mapTier(tier, variantsByTier.get(tier.tier) ?? []),
    );

    const activeVariantCount = sortedVariants.filter((variant) => variant.active).length;
    console.info(
      `[shop-catalog] admin list tiers=${catalog.length} variants=${sortedVariants.length} active_variants=${activeVariantCount}`,
    );

    return { tiers: catalog };
  },
});

export const upsertShopTier = mutation({
  args: {
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    title: v.string(),
    subtitle: v.optional(v.string()),
    badge: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ShopMutationResult<{ tierId: Id<"shopTiers"> }>> => {
    try {
      const now = Date.now();
      const title = normalizeRequired(args.title, {
        code: "title_required",
        message: "Title is required.",
      });
      const sortOrder = Number.isFinite(args.sortOrder)
        ? (args.sortOrder as number)
        : tierRank(args.tier) + 1;
      const existing = await ctx.db
        .query("shopTiers")
        .withIndex("by_tier", (q) => q.eq("tier", args.tier))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          title,
          subtitle: normalizeOptional(args.subtitle),
          badge: normalizeOptional(args.badge),
          description: normalizeOptional(args.description),
          sortOrder,
          active: args.active ?? existing.active,
          updatedAt: now,
        });
        console.info(
          `[shop-catalog] upsert tier tier=${args.tier} active=${args.active ?? existing.active}`,
        );
        return { ok: true, tierId: existing._id };
      }

      const tierId = await ctx.db.insert("shopTiers", {
        tier: args.tier,
        title,
        subtitle: normalizeOptional(args.subtitle),
        badge: normalizeOptional(args.badge),
        description: normalizeOptional(args.description),
        sortOrder,
        active: args.active ?? true,
        updatedAt: now,
      });
      console.info(
        `[shop-catalog] created tier tier=${args.tier} active=${args.active ?? true}`,
      );
      return { ok: true, tierId };
    } catch (error) {
      return { ok: false, error: asShopCatalogErrorShape(error) };
    }
  },
});

export const upsertShopVariant = mutation({
  args: {
    variantId: v.optional(v.id("shopVariants")),
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    durationDays: v.number(),
    displayPrice: v.string(),
    priceSuffix: v.optional(v.string()),
    checkoutUrl: v.string(),
    highlights: v.optional(v.array(v.string())),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    active: v.optional(v.boolean()),
    policyScope: v.union(v.literal("product"), v.literal("variant")),
    policyExternalId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<ShopMutationResult<{ variantId: Id<"shopVariants"> }>> => {
    try {
      const now = Date.now();
      const durationDays = assertValidDurationDays(args.durationDays);
      const displayPrice = normalizeRequired(
        args.displayPrice,
        {
          code: "display_price_required",
          message: "Display price is required.",
        },
      );
      const checkoutUrl = assertValidCheckoutUrl(args.checkoutUrl);
      const policyExternalId = normalizeRequired(
        args.policyExternalId,
        {
          code: "policy_external_id_required",
          message: "Policy external id is required.",
        },
      );

      const duplicates = await ctx.db
        .query("shopVariants")
        .withIndex("by_tier_durationDays", (q) =>
          q.eq("tier", args.tier).eq("durationDays", durationDays),
        )
        .collect();
      assertUniqueTierDuration(duplicates, {
        tier: args.tier,
        durationDays,
        excludeVariantId: args.variantId,
      });

      const linkedPolicy = await getLinkedPolicy(ctx, args.policyScope, policyExternalId);
      const policyEnabled = linkedPolicy?.enabled === true;
      assertLinkedPolicyEnabled(linkedPolicy ? { enabled: linkedPolicy.enabled } : null);

      const patch = {
        tier: args.tier,
        durationDays,
        displayPrice,
        priceSuffix: normalizeOptional(args.priceSuffix),
        checkoutUrl,
        highlights: normalizeHighlights(args.highlights),
        isFeatured: args.isFeatured === true,
        sortOrder: Number.isFinite(args.sortOrder)
          ? (args.sortOrder as number)
          : undefined,
        active: args.active ?? true,
        policyScope: args.policyScope,
        policyExternalId,
        updatedAt: now,
      };

      if (args.variantId) {
        const existing = await ctx.db.get(args.variantId);
        if (!existing) {
          throwShopCatalogError("variant_not_found", "Variant not found.");
        }
        await ctx.db.patch(existing._id, patch);
        console.info(
          `[shop-catalog] upsert variant variant=${existing._id} tier=${args.tier} duration_days=${durationDays} active=${patch.active} policy_scope=${args.policyScope} policy_id=${policyExternalId} policy_enabled=${policyEnabled}`,
        );
        return { ok: true, variantId: existing._id };
      }

      const variantId = await ctx.db.insert("shopVariants", patch);
      console.info(
        `[shop-catalog] created variant variant=${variantId} tier=${args.tier} duration_days=${durationDays} active=${patch.active} policy_scope=${args.policyScope} policy_id=${policyExternalId} policy_enabled=${policyEnabled}`,
      );
      return { ok: true, variantId };
    } catch (error) {
      return { ok: false, error: asShopCatalogErrorShape(error) };
    }
  },
});

export const removeShopVariant = mutation({
  args: {
    variantId: v.id("shopVariants"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<ShopMutationResult<{ removed: true }>> => {
    try {
      const existing = await ctx.db.get(args.variantId);
      if (!existing) {
        throwShopCatalogError("variant_not_found", "Variant not found.");
      }
      await ctx.db.delete(existing._id);
      console.info(`[shop-catalog] removed variant variant=${existing._id}`);
      return { ok: true, removed: true };
    } catch (error) {
      return { ok: false, error: asShopCatalogErrorShape(error) };
    }
  },
});

export const setShopVariantActive = mutation({
  args: {
    variantId: v.id("shopVariants"),
    active: v.boolean(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<ShopMutationResult<{ variantId: Id<"shopVariants">; active: boolean }>> => {
    try {
      const existing = await ctx.db.get(args.variantId);
      if (!existing) {
        throwShopCatalogError("variant_not_found", "Variant not found.");
      }

      if (args.active) {
        const linkedPolicy = await getLinkedPolicy(
          ctx,
          existing.policyScope,
          existing.policyExternalId,
        );
        assertLinkedPolicyEnabled(linkedPolicy ? { enabled: linkedPolicy.enabled } : null);
      }

      await ctx.db.patch(existing._id, {
        active: args.active,
        updatedAt: Date.now(),
      });
      console.info(
        `[shop-catalog] set active variant=${existing._id} active=${args.active}`,
      );
      return { ok: true, variantId: existing._id, active: args.active };
    } catch (error) {
      return { ok: false, error: asShopCatalogErrorShape(error) };
    }
  },
});
