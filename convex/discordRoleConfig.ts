import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

export const SUBSCRIPTION_TIERS = ["basic", "advanced", "pro"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

type TierRoleMapping = {
  tier: SubscriptionTier;
  productId: string;
  guildId: string;
  roleId: string;
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

export async function listEnabledTierRoleMappings(
  ctx: QueryCtx | MutationCtx,
): Promise<TierRoleMapping[]> {
  const rows = await ctx.db
    .query("discordTierRoleMappings")
    .withIndex("by_enabled", (q) => q.eq("enabled", true))
    .collect();

  return rows
    .map((row) => ({
      tier: row.tier,
      productId: row.productId,
      guildId: row.guildId,
      roleId: row.roleId,
      enabled: row.enabled,
      updatedAt: row.updatedAt,
    }))
    .sort(
      (a, b) =>
        SUBSCRIPTION_TIERS.indexOf(a.tier) - SUBSCRIPTION_TIERS.indexOf(b.tier),
    );
}

export const listTierRoleMappings = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("discordTierRoleMappings").collect();
    const map = new Map<SubscriptionTier, TierRoleMapping>();
    for (const row of rows) {
      map.set(row.tier, {
        tier: row.tier,
        productId: row.productId,
        guildId: row.guildId,
        roleId: row.roleId,
        enabled: row.enabled,
        updatedAt: row.updatedAt,
      });
    }

    return SUBSCRIPTION_TIERS.map((tier) => {
      const row = map.get(tier);
      return {
        tier,
        productId: row?.productId ?? "",
        guildId: row?.guildId ?? "",
        roleId: row?.roleId ?? "",
        enabled: row?.enabled ?? false,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  },
});

export const upsertTierRoleMapping = mutation({
  args: {
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    productId: v.string(),
    guildId: v.string(),
    roleId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const productId = normalizeRequired(args.productId, "product_id");
    const guildId = normalizeRequired(args.guildId, "guild_id");
    const roleId = normalizeRequired(args.roleId, "role_id");
    const now = Date.now();

    const byProduct = await ctx.db
      .query("discordTierRoleMappings")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .collect();
    const conflict = byProduct.find((row) => row.tier !== args.tier);
    if (conflict) {
      throw new Error(`product_id_in_use:${conflict.tier}`);
    }

    const existing = await ctx.db
      .query("discordTierRoleMappings")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        productId,
        guildId,
        roleId,
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("discordTierRoleMappings", {
        tier: args.tier,
        productId,
        guildId,
        roleId,
        enabled: args.enabled,
        updatedAt: now,
      });
    }

    console.info(
      `[discord-config] upsert tier=${args.tier} product=${productId} guild=${guildId} role=${roleId} enabled=${args.enabled}`,
    );

    return { ok: true as const };
  },
});

export const removeTierRoleMapping = mutation({
  args: {
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("discordTierRoleMappings")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .first();

    if (!existing) {
      return { ok: true as const, removed: false as const };
    }

    await ctx.db.delete(existing._id);
    console.info(`[discord-config] removed tier=${args.tier}`);
    return { ok: true as const, removed: true as const };
  },
});

export const getRoleSyncRuntimeStatus = query({
  args: {},
  handler: async () => {
    const hasRoleSyncBotToken = Boolean(
      process.env.ROLE_SYNC_BOT_TOKEN?.trim() ?? "",
    );
    const legacyGuildId = process.env.DISCORD_CUSTOMER_GUILD_ID?.trim() ?? "";
    const legacyRoleId = process.env.DISCORD_CUSTOMER_ROLE_ID?.trim() ?? "";

    return {
      hasRoleSyncBotToken,
      legacyFallbackConfigured: Boolean(legacyGuildId && legacyRoleId),
      legacyGuildId: legacyGuildId || null,
      legacyRoleId: legacyRoleId || null,
    };
  },
});
