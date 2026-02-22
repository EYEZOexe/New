import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

export const getConnectorByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("connectors")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
  },
});

export const getConnectorByTenantConnectorId = internalQuery({
  args: { tenantKey: v.string(), connectorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("connectors")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .first();
  },
});

export const touchConnectorLastSeen = internalMutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const connector = await ctx.db
      .query("connectors")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .first();

    if (!connector) return;

    await ctx.db.patch(connector._id, {
      lastSeenAt: args.now,
    });
  },
});

export const getRuntimeConfig = internalQuery({
  args: { tenantKey: v.string(), connectorId: v.string() },
  handler: async (ctx, args) => {
    const connector = await ctx.db
      .query("connectors")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .first();

    if (!connector) return null;

    const sources = await ctx.db
      .query("connectorSources")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();

    const mappings = await ctx.db
      .query("connectorMappings")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();

    return {
      connector,
      discoveryRequest: {
        version: connector.discoveryRequestVersion ?? 0,
        guildId: connector.discoveryRequestedGuildId ?? undefined,
        requestedAt: connector.discoveryRequestedAt ?? undefined,
      },
      sources: sources.map((s) => ({
        guild_id: s.guildId,
        channel_id: s.channelId,
        is_source: s.isSource ?? true,
        is_target: s.isTarget ?? false,
        thread_mode: s.threadMode ?? undefined,
        is_enabled: s.isEnabled,
      })),
      mappings: mappings.map((m) => ({
        source_channel_id: m.sourceChannelId,
        target_channel_id: m.targetChannelId,
        filters_json: m.filtersJson ?? undefined,
        transform_json: m.transformJson ?? undefined,
        priority: m.priority ?? undefined,
      })),
      forwardingEnabled: connector.forwardEnabled === true,
    };
  },
});

