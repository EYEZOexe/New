import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

export const SUBSCRIPTION_TIERS = ["basic", "advanced", "pro"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];
export type PolicyScope = "product" | "variant";

type AccessPolicy = {
  scope: PolicyScope;
  externalId: string;
  tier: SubscriptionTier;
  durationDays: number | null;
  enabled: boolean;
  updatedAt: number;
};

function extractPolicyMatchExternalId(externalId: string): string {
  const [first] = externalId.split("|");
  return (first ?? "").trim();
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field}_required`);
  }
  return normalized;
}

function normalizeDurationDays(durationDays: number | undefined): number {
  if (!Number.isFinite(durationDays) || !Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error("duration_days_invalid");
  }
  return durationDays;
}

function toRow(row: {
  scope: PolicyScope;
  externalId: string;
  tier: SubscriptionTier;
  durationDays?: number;
  enabled: boolean;
  updatedAt: number;
}): AccessPolicy {
  return {
    scope: row.scope,
    externalId: row.externalId,
    tier: row.tier,
    durationDays: row.durationDays ?? null,
    enabled: row.enabled,
    updatedAt: row.updatedAt,
  };
}

export async function resolveEnabledSellAccessPolicy(
  ctx: QueryCtx | MutationCtx,
  args: { productId: string | null; variantId: string | null },
): Promise<AccessPolicy | null> {
  const variantId = args.variantId?.trim() ?? "";
  const productId = args.productId?.trim() ?? "";

  // 1. Compound product:variant lookup — required when variant IDs are shared across products
  if (productId && variantId) {
    const compoundId = `${productId}:${variantId}`;
    const byCompound = await ctx.db
      .query("sellAccessPolicies")
      .withIndex("by_scope_externalId", (q) =>
        q.eq("scope", "variant").eq("externalId", compoundId),
      )
      .first();
    if (byCompound?.enabled) return toRow(byCompound);
  }

  // 2. Plain variant lookup — for products with unique variant IDs
  if (variantId) {
    const byVariant = await ctx.db
      .query("sellAccessPolicies")
      .withIndex("by_scope_externalId", (q) =>
        q.eq("scope", "variant").eq("externalId", variantId),
      )
      .first();
    if (byVariant?.enabled) return toRow(byVariant);

    const variantPolicies = await ctx.db.query("sellAccessPolicies").collect();
    const byVariantAlias = variantPolicies.find(
      (row) =>
        row.scope === "variant" &&
        row.enabled &&
        extractPolicyMatchExternalId(row.externalId) === variantId,
    );
    if (byVariantAlias) return toRow(byVariantAlias);
  }

  // 3. Product-level fallback
  if (productId) {
    const byProduct = await ctx.db
      .query("sellAccessPolicies")
      .withIndex("by_scope_externalId", (q) =>
        q.eq("scope", "product").eq("externalId", productId),
      )
      .first();
    if (byProduct?.enabled) return toRow(byProduct);

    const productPolicies = await ctx.db.query("sellAccessPolicies").collect();
    const byProductAlias = productPolicies.find(
      (row) =>
        row.scope === "product" &&
        row.enabled &&
        extractPolicyMatchExternalId(row.externalId) === productId,
    );
    if (byProductAlias) return toRow(byProductAlias);
  }

  return null;
}

export const listSellAccessPolicies = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("sellAccessPolicies").collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.map(toRow);
  },
});

export const upsertSellAccessPolicy = mutation({
  args: {
    scope: v.union(v.literal("product"), v.literal("variant")),
    externalId: v.string(),
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    durationDays: v.optional(v.number()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const externalId = normalizeRequired(args.externalId, "external_id");
    const durationDays = normalizeDurationDays(args.durationDays);
    const now = Date.now();

    const existing = await ctx.db
      .query("sellAccessPolicies")
      .withIndex("by_scope_externalId", (q) =>
        q.eq("scope", args.scope).eq("externalId", externalId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        billingMode: "fixed_term",
        durationDays,
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("sellAccessPolicies", {
        scope: args.scope,
        externalId,
        tier: args.tier,
        billingMode: "fixed_term",
        durationDays,
        enabled: args.enabled,
        updatedAt: now,
      });
    }

    console.info(
      `[sell-policy] upsert scope=${args.scope} id=${externalId} tier=${args.tier} duration_days=${durationDays} enabled=${args.enabled}`,
    );
    return { ok: true as const };
  },
});

export const removeSellAccessPolicy = mutation({
  args: {
    scope: v.union(v.literal("product"), v.literal("variant")),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    const externalId = normalizeRequired(args.externalId, "external_id");
    const existing = await ctx.db
      .query("sellAccessPolicies")
      .withIndex("by_scope_externalId", (q) =>
        q.eq("scope", args.scope).eq("externalId", externalId),
      )
      .first();
    if (!existing) {
      return { ok: true as const, removed: false as const };
    }
    await ctx.db.delete(existing._id);
    console.info(`[sell-policy] removed scope=${args.scope} id=${externalId}`);
    return { ok: true as const, removed: true as const };
  },
});

// Variant IDs 377190 / 378499 / 378500 are shared across all three tier products,
// so policies use compound "productId:variantId" keys to distinguish tier correctly.
const STANDARD_VARIANT_POLICIES: Array<{
  externalId: string;
  tier: SubscriptionTier;
  durationDays: number;
}> = [
  // basic-plan (350191)
  { externalId: "350191:377190", tier: "basic", durationDays: 30 },
  { externalId: "350191:378499", tier: "basic", durationDays: 60 },
  { externalId: "350191:378500", tier: "basic", durationDays: 90 },
  // advanced-plan (350192)
  { externalId: "350192:377190", tier: "advanced", durationDays: 30 },
  { externalId: "350192:378499", tier: "advanced", durationDays: 60 },
  { externalId: "350192:378500", tier: "advanced", durationDays: 90 },
  // pro-plan (350193)
  { externalId: "350193:377190", tier: "pro", durationDays: 30 },
  { externalId: "350193:378499", tier: "pro", durationDays: 60 },
  { externalId: "350193:378500", tier: "pro", durationDays: 90 },
  // trial (350194) — plain variant key since 377193 is unique to this product
  { externalId: "350194:377193", tier: "pro", durationDays: 7 },
];

export const seedStandardVariantPolicies = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const now = Date.now();
    let upserted = 0;

    for (const policy of STANDARD_VARIANT_POLICIES) {
      const existing = await ctx.db
        .query("sellAccessPolicies")
        .withIndex("by_scope_externalId", (q) =>
          q.eq("scope", "variant").eq("externalId", policy.externalId),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          tier: policy.tier,
          billingMode: "fixed_term",
          durationDays: policy.durationDays,
          enabled: true,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("sellAccessPolicies", {
          scope: "variant",
          externalId: policy.externalId,
          tier: policy.tier,
          billingMode: "fixed_term",
          durationDays: policy.durationDays,
          enabled: true,
          updatedAt: now,
        });
      }

      console.info(
        `[sell-policy] seed scope=variant id=${policy.externalId} tier=${policy.tier} duration_days=${policy.durationDays}`,
      );
      upserted++;
    }

    return { ok: true as const, upserted };
  },
});
