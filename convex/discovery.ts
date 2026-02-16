import { v } from "convex/values";

import { query } from "./_generated/server";

export const listGuilds = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("discordGuilds")
      .withIndex("by_tenant_connector_guildId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  },
});

export const listChannels = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = args.guildId
      ? await ctx.db
          .query("discordChannels")
          .withIndex("by_tenant_connector_guildId", (q) =>
            q
              .eq("tenantKey", args.tenantKey)
              .eq("connectorId", args.connectorId)
              .eq("guildId", args.guildId!),
          )
          .collect()
      : await ctx.db
          .query("discordChannels")
          .withIndex("by_tenant_connector_guildId", (q) =>
            q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
          )
          .collect();

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  },
});

