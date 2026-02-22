import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

function assertBotTokenOrThrow(token: string) {
  const roleToken = process.env.ROLE_SYNC_BOT_TOKEN?.trim() ?? "";
  const mirrorToken = process.env.MIRROR_BOT_TOKEN?.trim() ?? "";
  const allowed = new Set([roleToken, mirrorToken].filter((value) => value.length > 0));
  if (allowed.size === 0) {
    throw new Error("discord_bot_presence_token_not_configured");
  }
  if (!allowed.has(token)) {
    throw new Error("unauthorized");
  }
}

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

export const syncBotGuilds = mutation({
  args: {
    botToken: v.string(),
    guilds: v.array(
      v.object({
        guildId: v.string(),
        name: v.string(),
        icon: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertBotTokenOrThrow(args.botToken);
    const now = Date.now();
    const incomingByGuildId = new Map(
      args.guilds.map((guild) => [
        normalizeRequired(guild.guildId, "guild_id"),
        {
          name: normalizeRequired(guild.name, "guild_name"),
          icon: normalizeOptional(guild.icon),
        },
      ]),
    );

    const existingRows = await ctx.db.query("discordBotGuilds").collect();
    const existingByGuildId = new Map(existingRows.map((row) => [row.guildId, row]));

    let upserted = 0;
    let deactivated = 0;

    for (const [guildId, guild] of incomingByGuildId.entries()) {
      const existing = existingByGuildId.get(guildId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: guild.name,
          icon: guild.icon,
          active: true,
          lastSeenAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("discordBotGuilds", {
          guildId,
          name: guild.name,
          icon: guild.icon,
          active: true,
          lastSeenAt: now,
          updatedAt: now,
        });
      }
      upserted += 1;
    }

    for (const existing of existingRows) {
      if (incomingByGuildId.has(existing.guildId)) continue;
      if (!existing.active) continue;
      await ctx.db.patch(existing._id, {
        active: false,
        updatedAt: now,
      });
      deactivated += 1;
    }

    console.info(
      `[discord-bot-presence] sync guilds upserted=${upserted} deactivated=${deactivated}`,
    );

    return {
      ok: true as const,
      upserted,
      deactivated,
      total: incomingByGuildId.size,
    };
  },
});

export const listBotGuilds = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive === true;
    const rows = includeInactive
      ? await ctx.db.query("discordBotGuilds").collect()
      : await ctx.db
          .query("discordBotGuilds")
          .withIndex("by_active", (q) => q.eq("active", true))
          .collect();

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows.map((row) => ({
      guildId: row.guildId,
      name: row.name,
      icon: row.icon ?? null,
      active: row.active,
      lastSeenAt: row.lastSeenAt,
      updatedAt: row.updatedAt,
    }));
  },
});
