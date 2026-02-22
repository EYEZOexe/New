import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { enqueueSeatAuditJobForServer } from "./discordSeatAudit";

type SubscriptionTier = "basic" | "advanced" | "pro";

type ServerConfigRow = {
  tenantKey: string;
  connectorId: string;
  guildId: string;
  seatLimit: number;
  seatEnforcementEnabled: boolean;
  basicRoleId: string | null;
  advancedRoleId: string | null;
  proRoleId: string | null;
  updatedAt: number;
  createdAt: number;
};

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field}_required`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeSeatLimit(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error("seat_limit_invalid");
  }
  return value;
}

function toRow(args: {
  tenantKey: string;
  connectorId: string;
  guildId: string;
  seatLimit: number;
  seatEnforcementEnabled: boolean;
  basicRoleId?: string;
  advancedRoleId?: string;
  proRoleId?: string;
  updatedAt: number;
  createdAt: number;
}): ServerConfigRow {
  return {
    tenantKey: args.tenantKey,
    connectorId: args.connectorId,
    guildId: args.guildId,
    seatLimit: args.seatLimit,
    seatEnforcementEnabled: args.seatEnforcementEnabled,
    basicRoleId: args.basicRoleId ?? null,
    advancedRoleId: args.advancedRoleId ?? null,
    proRoleId: args.proRoleId ?? null,
    updatedAt: args.updatedAt,
    createdAt: args.createdAt,
  };
}

async function getServerConfigByKey(
  ctx: QueryCtx | MutationCtx,
  args: { tenantKey: string; connectorId: string; guildId: string },
) {
  return await ctx.db
    .query("discordServerConfigs")
    .withIndex("by_tenant_connector_guild", (q) =>
      q
        .eq("tenantKey", args.tenantKey)
        .eq("connectorId", args.connectorId)
        .eq("guildId", args.guildId),
    )
    .first();
}

export async function listManagedRoleTargetsFromServerConfig(
  ctx: QueryCtx | MutationCtx,
): Promise<
  Array<{
    tier: SubscriptionTier;
    guildId: string;
    roleId: string;
    tenantKey: string;
    connectorId: string;
  }>
> {
  const rows = await ctx.db.query("discordServerConfigs").collect();
  const targets: Array<{
    tier: SubscriptionTier;
    guildId: string;
    roleId: string;
    tenantKey: string;
    connectorId: string;
  }> = [];
  for (const row of rows) {
    const pushIfPresent = (tier: SubscriptionTier, roleId?: string) => {
      const normalized = normalizeOptional(roleId);
      if (!normalized) return;
      targets.push({
        tier,
        guildId: row.guildId,
        roleId: normalized,
        tenantKey: row.tenantKey,
        connectorId: row.connectorId,
      });
    };

    pushIfPresent("basic", row.basicRoleId);
    pushIfPresent("advanced", row.advancedRoleId);
    pushIfPresent("pro", row.proRoleId);
  }
  return targets;
}

export const listServerConfigsByConnector = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantKey = normalizeRequired(args.tenantKey, "tenant_key");
    const connectorId = normalizeRequired(args.connectorId, "connector_id");
    const rows = await ctx.db
      .query("discordServerConfigs")
      .withIndex("by_tenant_connector", (q) =>
        q.eq("tenantKey", tenantKey).eq("connectorId", connectorId),
      )
      .collect();

    rows.sort((a, b) => a.guildId.localeCompare(b.guildId));
    return rows.map((row) =>
      toRow({
        tenantKey: row.tenantKey,
        connectorId: row.connectorId,
        guildId: row.guildId,
        seatLimit: row.seatLimit,
        seatEnforcementEnabled: row.seatEnforcementEnabled,
        basicRoleId: row.basicRoleId,
        advancedRoleId: row.advancedRoleId,
        proRoleId: row.proRoleId,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      }),
    );
  },
});

export const getServerConfig = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantKey = normalizeRequired(args.tenantKey, "tenant_key");
    const connectorId = normalizeRequired(args.connectorId, "connector_id");
    const guildId = normalizeRequired(args.guildId, "guild_id");
    const existing = await getServerConfigByKey(ctx, {
      tenantKey,
      connectorId,
      guildId,
    });
    if (!existing) return null;
    return toRow({
      tenantKey: existing.tenantKey,
      connectorId: existing.connectorId,
      guildId: existing.guildId,
      seatLimit: existing.seatLimit,
      seatEnforcementEnabled: existing.seatEnforcementEnabled,
      basicRoleId: existing.basicRoleId,
      advancedRoleId: existing.advancedRoleId,
      proRoleId: existing.proRoleId,
      updatedAt: existing.updatedAt,
      createdAt: existing.createdAt,
    });
  },
});

export const upsertServerConfig = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    seatLimit: v.number(),
    seatEnforcementEnabled: v.boolean(),
    basicRoleId: v.optional(v.string()),
    advancedRoleId: v.optional(v.string()),
    proRoleId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tenantKey = normalizeRequired(args.tenantKey, "tenant_key");
    const connectorId = normalizeRequired(args.connectorId, "connector_id");
    const guildId = normalizeRequired(args.guildId, "guild_id");
    const seatLimit = normalizeSeatLimit(args.seatLimit);
    const basicRoleId = normalizeOptional(args.basicRoleId);
    const advancedRoleId = normalizeOptional(args.advancedRoleId);
    const proRoleId = normalizeOptional(args.proRoleId);
    const now = Date.now();

    const existing = await getServerConfigByKey(ctx, {
      tenantKey,
      connectorId,
      guildId,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        seatLimit,
        seatEnforcementEnabled: args.seatEnforcementEnabled,
        basicRoleId,
        advancedRoleId,
        proRoleId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("discordServerConfigs", {
        tenantKey,
        connectorId,
        guildId,
        seatLimit,
        seatEnforcementEnabled: args.seatEnforcementEnabled,
        basicRoleId,
        advancedRoleId,
        proRoleId,
        updatedAt: now,
        createdAt: now,
      });
    }

    console.info(
      `[discord-server-config] upsert tenant=${tenantKey} connector=${connectorId} guild=${guildId} seat_limit=${seatLimit} enforcement=${args.seatEnforcementEnabled}`,
    );

    if (args.seatEnforcementEnabled) {
      await enqueueSeatAuditJobForServer(ctx, {
        tenantKey,
        connectorId,
        guildId,
        source: "server_config_upsert",
        now,
      });
    }

    return { ok: true as const };
  },
});

export const removeServerConfig = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantKey = normalizeRequired(args.tenantKey, "tenant_key");
    const connectorId = normalizeRequired(args.connectorId, "connector_id");
    const guildId = normalizeRequired(args.guildId, "guild_id");
    const existing = await getServerConfigByKey(ctx, {
      tenantKey,
      connectorId,
      guildId,
    });

    if (!existing) {
      return { ok: true as const, removed: false as const };
    }

    await ctx.db.delete(existing._id);
    console.info(
      `[discord-server-config] removed tenant=${tenantKey} connector=${connectorId} guild=${guildId}`,
    );
    return { ok: true as const, removed: true as const };
  },
});
