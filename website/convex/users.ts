import { getAuthUserId } from "@convex-dev/auth/server";
import { queryGeneric } from "convex/server";

export const viewer = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return {
      userId,
      email: typeof user.email === "string" ? user.email : null,
      name: typeof user.name === "string" ? user.name : null,
      subscriptionStatus: subscription?.status ?? null,
      hasSignalAccess: subscription?.status === "active",
    };
  },
});
