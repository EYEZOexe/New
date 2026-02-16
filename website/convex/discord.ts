import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

async function listLinksByUserId(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Array<Doc<"discordLinks">>> {
  return await ctx.db
    .query("discordLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

function normalizeUsername(username: string | undefined): string | undefined {
  if (!username) return undefined;
  const trimmed = username.trim();
  return trimmed ? trimmed : undefined;
}

export const viewerLink = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const rows = await listLinksByUserId(ctx, userId);
    const active = rows.find((row) => row.unlinkedAt === undefined);
    if (!active) {
      return {
        isLinked: false,
        discordUserId: null,
        username: null,
        linkedAt: null,
      };
    }

    return {
      isLinked: true,
      discordUserId: active.discordUserId,
      username: active.username ?? null,
      linkedAt: active.linkedAt,
    };
  },
});

export const linkViewerDiscord = mutation({
  args: {
    discordUserId: v.string(),
    username: v.optional(v.string()),
    linkedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("unauthenticated");
    }

    const discordUserId = args.discordUserId.trim();
    if (!discordUserId) {
      throw new Error("discord_user_id_required");
    }

    const now = args.linkedAt ?? Date.now();
    const username = normalizeUsername(args.username);

    const rowsForDiscordUser = await ctx.db
      .query("discordLinks")
      .withIndex("by_discordUserId", (q) => q.eq("discordUserId", discordUserId))
      .collect();

    const conflict = rowsForDiscordUser.find(
      (row) => row.unlinkedAt === undefined && row.userId !== userId,
    );
    if (conflict) {
      throw new Error("discord_account_already_linked");
    }

    const existingByUser = await listLinksByUserId(ctx, userId);
    for (const row of existingByUser) {
      if (row.unlinkedAt === undefined) {
        await ctx.db.patch(row._id, { unlinkedAt: now });
      }
    }

    const existingSameDiscord = existingByUser.find(
      (row) => row.discordUserId === discordUserId,
    );
    if (existingSameDiscord) {
      await ctx.db.patch(existingSameDiscord._id, {
        linkedAt: now,
        username,
        unlinkedAt: undefined,
      });
    } else {
      await ctx.db.insert("discordLinks", {
        userId,
        discordUserId,
        username,
        linkedAt: now,
      });
    }

    console.info(
      `[discord-link] linked user=${userId} discord_user=${discordUserId} username=${username ?? "none"}`,
    );

    return {
      ok: true,
      isLinked: true,
      discordUserId,
      username: username ?? null,
      linkedAt: now,
    };
  },
});

export const unlinkViewerDiscord = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("unauthenticated");
    }

    const now = Date.now();
    const existingByUser = await listLinksByUserId(ctx, userId);
    const activeRows = existingByUser.filter((row) => row.unlinkedAt === undefined);
    if (activeRows.length === 0) {
      return { ok: true, unlinked: false };
    }

    for (const row of activeRows) {
      await ctx.db.patch(row._id, { unlinkedAt: now });
    }

    console.info(
      `[discord-link] unlinked user=${userId} active_links=${activeRows.length}`,
    );

    return { ok: true, unlinked: true };
  },
});
