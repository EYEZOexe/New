import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { sha256Hex } from "./connectorsAuth";

function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nowMs() {
  return Date.now();
}

async function getConnectorOrNull(
  ctx: QueryCtx | MutationCtx,
  tenantKey: string,
  connectorId: string,
) {
  return await ctx.db
    .query("connectors")
    .withIndex("by_tenant_connectorId", (q) =>
      q.eq("tenantKey", tenantKey).eq("connectorId", connectorId),
    )
    .first();
}

async function bumpConfigVersion(
  ctx: MutationCtx,
  connectorDoc: Doc<"connectors">,
) {
  await ctx.db.patch(connectorDoc._id, {
    configVersion: (connectorDoc.configVersion ?? 0) + 1,
    updatedAt: nowMs(),
  });
}

export const listConnectors = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("connectors").collect();
  },
});

export const getConnector = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    return await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
  },
});

export const listSources = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("connectorSources")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();

    rows.sort((a, b) =>
      `${a.guildId}:${a.channelId}`.localeCompare(`${b.guildId}:${b.channelId}`),
    );
    return rows;
  },
});

export const listMappings = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("connectorMappings")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();

    rows.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return rows;
  },
});

export const listMappingsForGuild = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const guildId = args.guildId.trim();
    if (!guildId) return [];

    const [mappings, sources, discoveredGuilds, botGuilds] = await Promise.all([
      ctx.db
        .query("connectorMappings")
        .withIndex("by_tenant_connectorId", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .collect(),
      ctx.db
        .query("connectorSources")
        .withIndex("by_tenant_connectorId", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .collect(),
      ctx.db
        .query("discordGuilds")
        .withIndex("by_tenant_connector_guildId", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .collect(),
      ctx.db.query("discordBotGuilds").collect(),
    ]);

    const discoveredGuildNameById = new Map(
      discoveredGuilds.map((row) => [row.guildId.trim(), row.name]),
    );
    const botGuildNameById = new Map(
      botGuilds.map((row) => [row.guildId.trim(), row.name]),
    );
    const sourceGuildByChannelId = new Map(
      sources.map((source) => [source.channelId.trim(), source.guildId.trim()]),
    );

    const uniqueChannelIds = new Set<string>();
    for (const mapping of mappings) {
      const sourceChannelId = mapping.sourceChannelId.trim();
      const targetChannelId = mapping.targetChannelId.trim();
      if (sourceChannelId) uniqueChannelIds.add(sourceChannelId);
      if (targetChannelId) uniqueChannelIds.add(targetChannelId);
    }
    const [pluginChannelRows, botChannelRows] = await Promise.all([
      Promise.all(
        Array.from(uniqueChannelIds.values()).map((channelId) =>
          ctx.db
            .query("discordChannels")
            .withIndex("by_tenant_connector_channelId", (q) =>
              q
                .eq("tenantKey", args.tenantKey)
                .eq("connectorId", args.connectorId)
                .eq("channelId", channelId),
            )
            .first(),
        ),
      ),
      Promise.all(
        Array.from(uniqueChannelIds.values()).map((channelId) =>
          ctx.db
            .query("discordBotChannels")
            .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
            .first(),
        ),
      ),
    ]);
    const pluginChannelNameById = new Map(
      pluginChannelRows
        .filter((channel): channel is NonNullable<typeof channel> => channel !== null)
        .map((channel) => [channel.channelId, channel.name]),
    );
    const botChannelNameById = new Map(
      botChannelRows
        .filter((channel): channel is NonNullable<typeof channel> => channel !== null)
        .map((channel) => [channel.channelId, channel.name]),
    );
    const botGuildByChannelId = new Map(
      botChannelRows
        .filter((channel): channel is NonNullable<typeof channel> => channel !== null)
        .map((channel) => [channel.channelId, channel.guildId.trim()]),
    );

    const resolveTargetGuildId = (channelId: string): string | null =>
      botGuildByChannelId.get(channelId) ?? sourceGuildByChannelId.get(channelId) ?? null;
    const resolveSourceGuildId = (channelId: string): string | null =>
      sourceGuildByChannelId.get(channelId) ?? null;

    const filtered = mappings
      .map((mapping) => ({
        sourceChannelId: mapping.sourceChannelId.trim(),
        targetChannelId: mapping.targetChannelId.trim(),
        priority: mapping.priority ?? null,
      }))
      .filter(
        (mapping) =>
          mapping.sourceChannelId.length > 0 &&
          mapping.targetChannelId.length > 0 &&
          resolveTargetGuildId(mapping.targetChannelId) === guildId,
      );

    const rows = filtered.map((mapping) => {
      const sourceGuildId = resolveSourceGuildId(mapping.sourceChannelId);
      const targetGuildId = resolveTargetGuildId(mapping.targetChannelId);
      return {
      sourceChannelId: mapping.sourceChannelId,
      targetChannelId: mapping.targetChannelId,
      sourceGuildId,
      targetGuildId,
      sourceGuildName:
        sourceGuildId === null
          ? null
          : (discoveredGuildNameById.get(sourceGuildId) ?? botGuildNameById.get(sourceGuildId) ?? null),
      targetGuildName:
        targetGuildId === null
          ? null
          : (botGuildNameById.get(targetGuildId) ?? discoveredGuildNameById.get(targetGuildId) ?? null),
      sourceChannelName:
        pluginChannelNameById.get(mapping.sourceChannelId) ??
        botChannelNameById.get(mapping.sourceChannelId) ??
        null,
      targetChannelName:
        botChannelNameById.get(mapping.targetChannelId) ??
        pluginChannelNameById.get(mapping.targetChannelId) ??
        null,
      priority: mapping.priority,
      };
    });

    rows.sort((a, b) => {
      const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
      if (byPriority !== 0) return byPriority;
      return `${a.sourceChannelId}:${a.targetChannelId}`.localeCompare(
        `${b.sourceChannelId}:${b.targetChannelId}`,
      );
    });
    return rows;
  },
});

export const rotateConnectorToken = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    // Token is returned once. Only its hash is stored.
    const token = `tok_${randomHex(32)}`;
    const tokenHash = await sha256Hex(token);

    const existing = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    const ts = nowMs();

    if (!existing) {
      await ctx.db.insert("connectors", {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        tokenHash,
        status: "active",
        forwardEnabled: false,
        configVersion: 1,
        discoveryRequestVersion: 0,
        updatedAt: ts,
        lastSeenAt: 0,
      });
    } else {
      await ctx.db.patch(existing._id, {
        tokenHash,
        updatedAt: ts,
      });
    }

    return { token };
  },
});

export const requestChannelDiscovery = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connector = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    if (!connector) throw new Error("connector_not_found");

    const now = nowMs();
    const nextDiscoveryVersion = (connector.discoveryRequestVersion ?? 0) + 1;
    const guildId = typeof args.guildId === "string" ? args.guildId.trim() : "";

    await ctx.db.patch(connector._id, {
      discoveryRequestVersion: nextDiscoveryVersion,
      discoveryRequestedGuildId: guildId || undefined,
      discoveryRequestedAt: now,
      updatedAt: now,
    });

    return { ok: true, requestVersion: nextDiscoveryVersion };
  },
});

export const setConnectorStatus = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    status: v.union(v.literal("active"), v.literal("paused")),
  },
  handler: async (ctx, args) => {
    const connector = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    if (!connector) {
      throw new Error("connector_not_found");
    }

    await ctx.db.patch(connector._id, {
      status: args.status,
      updatedAt: nowMs(),
    });

    return { ok: true };
  },
});

export const setForwardingEnabled = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const connector = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    if (!connector) {
      throw new Error("connector_not_found");
    }

    await ctx.db.patch(connector._id, {
      forwardEnabled: args.enabled,
      updatedAt: nowMs(),
    });
    await bumpConfigVersion(ctx, connector);

    return { ok: true };
  },
});

export const upsertSource = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    channelId: v.string(),
    isSource: v.boolean(),
    isTarget: v.boolean(),
    threadMode: v.optional(
      v.union(v.literal("include"), v.literal("exclude"), v.literal("only")),
    ),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const connector = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    if (!connector) throw new Error("connector_not_found");

    const existing = await ctx.db
      .query("connectorSources")
      .withIndex("by_tenant_connector_channelId", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("channelId", args.channelId),
      )
      .first();

    const ts = nowMs();
    if (!existing) {
      await ctx.db.insert("connectorSources", {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        guildId: args.guildId,
        channelId: args.channelId,
        isSource: args.isSource,
        isTarget: args.isTarget,
        threadMode: args.threadMode,
        isEnabled: args.isEnabled,
        updatedAt: ts,
      });
    } else {
      await ctx.db.patch(existing._id, {
        guildId: args.guildId,
        isSource: args.isSource,
        isTarget: args.isTarget,
        threadMode: args.threadMode,
        isEnabled: args.isEnabled,
        updatedAt: ts,
      });
    }

    await bumpConfigVersion(ctx, connector);
    return { ok: true };
  },
});

export const removeSource = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const connector = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    if (!connector) throw new Error("connector_not_found");

    const existing = await ctx.db
      .query("connectorSources")
      .withIndex("by_tenant_connector_channelId", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("channelId", args.channelId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await bumpConfigVersion(ctx, connector);
    }

    return { ok: true };
  },
});

export const upsertMapping = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceChannelId: v.string(),
    targetChannelId: v.string(),
    dashboardEnabled: v.optional(v.boolean()),
    minimumTier: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    ),
    filtersJson: v.optional(v.any()),
    transformJson: v.optional(v.any()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const connector = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    if (!connector) throw new Error("connector_not_found");

    const existing = await ctx.db
      .query("connectorMappings")
      .withIndex("by_tenant_connector_sourceChannelId", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("sourceChannelId", args.sourceChannelId),
      )
      .first();

    const ts = nowMs();
    if (!existing) {
      await ctx.db.insert("connectorMappings", {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        sourceChannelId: args.sourceChannelId,
        targetChannelId: args.targetChannelId,
        dashboardEnabled: args.dashboardEnabled,
        minimumTier: args.minimumTier,
        filtersJson: args.filtersJson,
        transformJson: args.transformJson,
        priority: args.priority,
        updatedAt: ts,
      });
    } else {
      await ctx.db.patch(existing._id, {
        targetChannelId: args.targetChannelId,
        dashboardEnabled: args.dashboardEnabled,
        minimumTier: args.minimumTier,
        filtersJson: args.filtersJson,
        transformJson: args.transformJson,
        priority: args.priority,
        updatedAt: ts,
      });
    }

    await bumpConfigVersion(ctx, connector);
    return { ok: true };
  },
});

export const removeMapping = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceChannelId: v.string(),
  },
  handler: async (ctx, args) => {
    const connector = await getConnectorOrNull(ctx, args.tenantKey, args.connectorId);
    if (!connector) throw new Error("connector_not_found");

    const existing = await ctx.db
      .query("connectorMappings")
      .withIndex("by_tenant_connector_sourceChannelId", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("sourceChannelId", args.sourceChannelId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await bumpConfigVersion(ctx, connector);
    }

    return { ok: true };
  },
});

export const getConnectorHealthSummary = query({
  args: {},
  handler: async (ctx) => {
    const connectors = await ctx.db.query("connectors").collect();

    // Query failed, pending, and processing jobs globally using by_status_updatedAt index.
    // This avoids N+1 queries and unbounded memory use by scanning 3 status buckets instead of querying per-connector.
    // totalJobs = failedJobs + pendingJobs + processingJobs (active jobs only, excludes historical completed).
    // take(8192) guards against Convex's 16,384-doc collect limit in case failed/pending rows grow large.
    const [failedJobs, pendingJobs, processingJobs] = await Promise.all([
      ctx.db
        .query("signalMirrorJobs")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "failed"))
        .take(8192),
      ctx.db
        .query("signalMirrorJobs")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "pending"))
        .take(8192),
      ctx.db
        .query("signalMirrorJobs")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "processing"))
        .take(8192),
    ]);

    // Build maps: key = `${tenantKey}::${connectorId}`
    const failedByConnector = new Map<string, number>();
    const pendingByConnector = new Map<string, number>();
    const processingByConnector = new Map<string, number>();

    for (const job of failedJobs) {
      const key = `${job.tenantKey}::${job.connectorId}`;
      failedByConnector.set(key, (failedByConnector.get(key) ?? 0) + 1);
    }
    for (const job of pendingJobs) {
      const key = `${job.tenantKey}::${job.connectorId}`;
      pendingByConnector.set(key, (pendingByConnector.get(key) ?? 0) + 1);
    }
    for (const job of processingJobs) {
      const key = `${job.tenantKey}::${job.connectorId}`;
      processingByConnector.set(key, (processingByConnector.get(key) ?? 0) + 1);
    }

    return connectors.map((connector) => {
      const key = `${connector.tenantKey}::${connector.connectorId}`;
      const failedCount = failedByConnector.get(key) ?? 0;
      const pendingCount = pendingByConnector.get(key) ?? 0;
      const processingCount = processingByConnector.get(key) ?? 0;
      return {
        tenantKey: connector.tenantKey,
        connectorId: connector.connectorId,
        failedJobs: failedCount,
        pendingJobs: pendingCount,
        totalJobs: failedCount + pendingCount + processingCount,
      };
    });
  },
});

export const listRecentJobsGlobal = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const clampedLimit = Math.max(1, Math.min(50, args.limit));
    const statuses = ["pending", "processing", "completed", "failed"] as const;

    // Query each status bucket separately using the by_status_updatedAt index.
    // This fetches up to clampedLimit items from each of the 4 status buckets (up to 4x clampedLimit docs total),
    // then merges and sorts by updatedAt globally. This ensures we get the true top-N across all statuses.
    const jobsByStatus = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query("signalMirrorJobs")
          .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
          .order("desc")
          .take(clampedLimit),
      ),
    );

    // Flatten and merge all results
    const allJobs = jobsByStatus.flat();

    // Sort by updatedAt descending across all statuses
    allJobs.sort((a, b) => b.updatedAt - a.updatedAt);

    // Slice to limit and map to output shape
    return allJobs.slice(0, clampedLimit).map((job) => ({
      _id: job._id,
      updatedAt: job.updatedAt,
      eventType: job.eventType,
      tenantKey: job.tenantKey,
      connectorId: job.connectorId,
      sourceChannelId: job.sourceChannelId,
      targetChannelId: job.targetChannelId,
      status: job.status,
      attempts: job.attemptCount,
    }));
  },
});
