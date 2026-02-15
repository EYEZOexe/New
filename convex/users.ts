import { query } from "convex/server";
import { auth } from "./auth";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    // Convex Auth's users table is owned by the library; keep our reads defensive.
    const emailRaw = (user as { email?: unknown }).email;
    const nameRaw = (user as { name?: unknown }).name;
    const email = typeof emailRaw === "string" ? emailRaw : null;
    const name = typeof nameRaw === "string" ? nameRaw : null;

    return {
      userId,
      email,
      name,
      subscription: sub
        ? { status: sub.status, plan: sub.plan ?? null, updatedAt: sub.updatedAt }
        : null,
    };
  },
});

