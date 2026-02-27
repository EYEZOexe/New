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
      const channelRows = await ctx.db
        .query("discordBotChannels")
        .withIndex("by_guildId", (q) => q.eq("guildId", existing.guildId))
        .collect();
      for (const channelRow of channelRows) {
        if (!channelRow.active) continue;
        await ctx.db.patch(channelRow._id, {
          active: false,
          updatedAt: now,
        });
      }
      const roleRows = await ctx.db
        .query("discordBotRoles")
        .withIndex("by_guildId", (q) => q.eq("guildId", existing.guildId))
        .collect();
      for (const roleRow of roleRows) {
        if (!roleRow.active) continue;
        await ctx.db.patch(roleRow._id, {
          active: false,
          updatedAt: now,
        });
      }
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

export const syncBotGuildChannels = mutation({
  args: {
    botToken: v.string(),
    guildId: v.string(),
    channels: v.array(
      v.object({
        channelId: v.string(),
        name: v.string(),
        type: v.optional(v.number()),
        parentId: v.optional(v.string()),
        position: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertBotTokenOrThrow(args.botToken);
    const guildId = normalizeRequired(args.guildId, "guild_id");
    const now = Date.now();
    const incomingByChannelId = new Map(
      args.channels.map((channel) => [
        normalizeRequired(channel.channelId, "channel_id"),
        {
          name: normalizeRequired(channel.name, "channel_name"),
          type: typeof channel.type === "number" ? channel.type : undefined,
          parentId: normalizeOptional(channel.parentId),
          position: typeof channel.position === "number" ? channel.position : undefined,
        },
      ]),
    );

    const existingRows = await ctx.db
      .query("discordBotChannels")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const existingByChannelId = new Map(
      existingRows.map((row) => [row.channelId, row]),
    );

    let upserted = 0;
    let deactivated = 0;
    for (const [channelId, channel] of incomingByChannelId.entries()) {
      const existing = existingByChannelId.get(channelId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId,
          position: channel.position,
          active: true,
          lastSeenAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("discordBotChannels", {
          guildId,
          channelId,
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId,
          position: channel.position,
          active: true,
          lastSeenAt: now,
          updatedAt: now,
        });
      }
      upserted += 1;
    }

    for (const existing of existingRows) {
      if (incomingByChannelId.has(existing.channelId)) continue;
      if (!existing.active) continue;
      await ctx.db.patch(existing._id, {
        active: false,
        updatedAt: now,
      });
      deactivated += 1;
    }

    console.info(
      `[discord-bot-presence] sync channels guild=${guildId} upserted=${upserted} deactivated=${deactivated}`,
    );
    return {
      ok: true as const,
      guildId,
      upserted,
      deactivated,
      total: incomingByChannelId.size,
    };
  },
});

export const syncBotGuildRoles = mutation({
  args: {
    botToken: v.string(),
    guildId: v.string(),
    roles: v.array(
      v.object({
        roleId: v.string(),
        name: v.string(),
        position: v.optional(v.number()),
        managed: v.optional(v.boolean()),
        mentionable: v.optional(v.boolean()),
        hoist: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertBotTokenOrThrow(args.botToken);
    const guildId = normalizeRequired(args.guildId, "guild_id");
    const now = Date.now();
    const incomingByRoleId = new Map(
      args.roles.map((role) => [
        normalizeRequired(role.roleId, "role_id"),
        {
          name: normalizeRequired(role.name, "role_name"),
          position: typeof role.position === "number" ? role.position : undefined,
          managed: typeof role.managed === "boolean" ? role.managed : undefined,
          mentionable: typeof role.mentionable === "boolean" ? role.mentionable : undefined,
          hoist: typeof role.hoist === "boolean" ? role.hoist : undefined,
        },
      ]),
    );

    const existingRows = await ctx.db
      .query("discordBotRoles")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const existingByRoleId = new Map(existingRows.map((row) => [row.roleId, row]));

    let upserted = 0;
    let deactivated = 0;
    for (const [roleId, role] of incomingByRoleId.entries()) {
      const existing = existingByRoleId.get(roleId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: role.name,
          position: role.position,
          managed: role.managed,
          mentionable: role.mentionable,
          hoist: role.hoist,
          active: true,
          lastSeenAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("discordBotRoles", {
          guildId,
          roleId,
          name: role.name,
          position: role.position,
          managed: role.managed,
          mentionable: role.mentionable,
          hoist: role.hoist,
          active: true,
          lastSeenAt: now,
          updatedAt: now,
        });
      }
      upserted += 1;
    }

    for (const existing of existingRows) {
      if (incomingByRoleId.has(existing.roleId)) continue;
      if (!existing.active) continue;
      await ctx.db.patch(existing._id, {
        active: false,
        updatedAt: now,
      });
      deactivated += 1;
    }

    console.info(
      `[discord-bot-presence] sync roles guild=${guildId} upserted=${upserted} deactivated=${deactivated}`,
    );
    return {
      ok: true as const,
      guildId,
      upserted,
      deactivated,
      total: incomingByRoleId.size,
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

export const listBotGuildChannels = query({
  args: {
    guildId: v.optional(v.string()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive === true;
    const guildId = args.guildId?.trim() ?? "";
    const rows = includeInactive
      ? guildId
        ? await ctx.db
            .query("discordBotChannels")
            .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
            .collect()
        : await ctx.db.query("discordBotChannels").collect()
      : await ctx.db
          .query("discordBotChannels")
          .withIndex("by_active", (q) => q.eq("active", true))
          .collect();

    const filtered = guildId
      ? rows.filter((row) => row.guildId === guildId)
      : rows;
    filtered.sort((a, b) => {
      const byGuild = a.guildId.localeCompare(b.guildId);
      if (byGuild !== 0) return byGuild;
      const posA = typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
      const posB = typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name);
    });
    return filtered.map((row) => ({
      guildId: row.guildId,
      channelId: row.channelId,
      name: row.name,
      type: typeof row.type === "number" ? row.type : null,
      parentId: row.parentId ?? null,
      position: typeof row.position === "number" ? row.position : null,
      active: row.active,
      lastSeenAt: row.lastSeenAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const listBotGuildRoles = query({
  args: {
    guildId: v.optional(v.string()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive === true;
    const guildId = args.guildId?.trim() ?? "";
    const rows = includeInactive
      ? guildId
        ? await ctx.db
            .query("discordBotRoles")
            .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
            .collect()
        : await ctx.db.query("discordBotRoles").collect()
      : await ctx.db
          .query("discordBotRoles")
          .withIndex("by_active", (q) => q.eq("active", true))
          .collect();

    const filtered = guildId ? rows.filter((row) => row.guildId === guildId) : rows;
    filtered.sort((a, b) => {
      const byGuild = a.guildId.localeCompare(b.guildId);
      if (byGuild !== 0) return byGuild;
      const posA = typeof a.position === "number" ? a.position : Number.MIN_SAFE_INTEGER;
      const posB = typeof b.position === "number" ? b.position : Number.MIN_SAFE_INTEGER;
      if (posA !== posB) return posB - posA;
      return a.name.localeCompare(b.name);
    });
    return filtered.map((row) => ({
      guildId: row.guildId,
      roleId: row.roleId,
      name: row.name,
      position: typeof row.position === "number" ? row.position : null,
      managed: typeof row.managed === "boolean" ? row.managed : null,
      mentionable: typeof row.mentionable === "boolean" ? row.mentionable : null,
      hoist: typeof row.hoist === "boolean" ? row.hoist : null,
      active: row.active,
      lastSeenAt: row.lastSeenAt,
      updatedAt: row.updatedAt,
    }));
  },
});
