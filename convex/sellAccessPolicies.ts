import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

export const SUBSCRIPTION_TIERS = ["basic", "advanced", "pro"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];
export type BillingMode = "recurring" | "fixed_term";
export type PolicyScope = "product" | "variant";

type AccessPolicy = {
  scope: PolicyScope;
  externalId: string;
  tier: SubscriptionTier;
  billingMode: BillingMode;
  durationDays: number | null;
  enabled: boolean;
  updatedAt: number;
};

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field}_required`);
  }
  return normalized;
}

function normalizeDurationDays(
  billingMode: BillingMode,
  durationDays: number | undefined,
): number | null {
  if (billingMode === "recurring") return null;
  if (!Number.isFinite(durationDays) || !Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error("duration_days_invalid");
  }
  return durationDays;
}

function toRow(row: {
  scope: PolicyScope;
  externalId: string;
  tier: SubscriptionTier;
  billingMode: BillingMode;
  durationDays?: number;
  enabled: boolean;
  updatedAt: number;
}): AccessPolicy {
  return {
    scope: row.scope,
    externalId: row.externalId,
    tier: row.tier,
    billingMode: row.billingMode,
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
  if (variantId) {
    const byVariant = await ctx.db
      .query("sellAccessPolicies")
      .withIndex("by_scope_externalId", (q) =>
        q.eq("scope", "variant").eq("externalId", variantId),
      )
      .first();
    if (byVariant?.enabled) return toRow(byVariant);
  }

  const productId = args.productId?.trim() ?? "";
  if (productId) {
    const byProduct = await ctx.db
      .query("sellAccessPolicies")
      .withIndex("by_scope_externalId", (q) =>
        q.eq("scope", "product").eq("externalId", productId),
      )
      .first();
    if (byProduct?.enabled) return toRow(byProduct);
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
    billingMode: v.union(v.literal("recurring"), v.literal("fixed_term")),
    durationDays: v.optional(v.number()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const externalId = normalizeRequired(args.externalId, "external_id");
    const durationDays = normalizeDurationDays(args.billingMode, args.durationDays);
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
        billingMode: args.billingMode,
        durationDays: durationDays ?? undefined,
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("sellAccessPolicies", {
        scope: args.scope,
        externalId,
        tier: args.tier,
        billingMode: args.billingMode,
        durationDays: durationDays ?? undefined,
        enabled: args.enabled,
        updatedAt: now,
      });
    }

    console.info(
      `[sell-policy] upsert scope=${args.scope} id=${externalId} tier=${args.tier} billing=${args.billingMode} duration_days=${durationDays ?? 0} enabled=${args.enabled}`,
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
