import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { query } from "./_generated/server";

export const listRecent = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      console.info("[signals] blocked unauthenticated listRecent request");
      return [];
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (subscription?.status !== "active") {
      console.info(
        `[signals] blocked user=${String(userId)} status=${subscription?.status ?? "none"} tenant=${args.tenantKey} connector=${args.connectorId}`,
      );
      return [];
    }

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

