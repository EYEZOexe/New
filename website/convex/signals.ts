import { v } from "convex/values";

import { query } from "./_generated/server";

export const listRecent = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, args.limit ?? 50));

    return await ctx.db
      .query("signals")
      .withIndex("by_createdAt", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .order("desc")
      .take(limit);
  },
});

