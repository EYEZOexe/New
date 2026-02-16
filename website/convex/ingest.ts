import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { messageEventToSignalFields } from "./ingestUtils";

const IngestAttachment = v.object({
  discord_attachment_id: v.string(),
  filename: v.string(),
  source_url: v.string(),
  size: v.number(),
  content_type: v.optional(v.union(v.string(), v.null())),
});

const IngestMessageEvent = v.object({
  idempotency_key: v.string(),
  event_type: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
  discord_message_id: v.string(),
  discord_guild_id: v.string(),
  discord_channel_id: v.string(),
  discord_thread_id: v.optional(v.union(v.string(), v.null())),
  discord_author_id: v.optional(v.union(v.string(), v.null())),
  author_username: v.optional(v.union(v.string(), v.null())),
  author_global_name: v.optional(v.union(v.string(), v.null())),
  content_raw: v.string(),
  content_clean: v.string(),
  created_at: v.string(),
  edited_at: v.optional(v.union(v.string(), v.null())),
  deleted_at: v.optional(v.union(v.string(), v.null())),
  attachments: v.array(IngestAttachment),
  embeds: v.array(v.any()),
  mentioned_role_ids: v.optional(v.array(v.string())),
  mentioned_user_ids: v.optional(v.array(v.string())),
});

const IngestGuild = v.object({
  discord_guild_id: v.string(),
  name: v.string(),
});

const IngestChannel = v.object({
  discord_channel_id: v.string(),
  guild_id: v.string(),
  name: v.string(),
  type: v.optional(v.union(v.number(), v.null())),
  parent_id: v.optional(v.union(v.string(), v.null())),
  position: v.optional(v.union(v.number(), v.null())),
});

const IngestThreadEvent = v.object({
  idempotency_key: v.string(),
  event_type: v.union(
    v.literal("create"),
    v.literal("update"),
    v.literal("delete"),
    v.literal("members_update"),
  ),
  thread: v.object({
    discord_thread_id: v.string(),
    parent_channel_id: v.string(),
    guild_id: v.string(),
    name: v.string(),
    archived: v.optional(v.boolean()),
    locked: v.optional(v.boolean()),
    message_count: v.optional(v.union(v.number(), v.null())),
    member_count: v.optional(v.union(v.number(), v.null())),
  }),
  member_delta: v.optional(v.any()),
});

export const ingestMessageBatch = internalMutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    messages: v.array(IngestMessageEvent),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    let accepted = 0;
    let deduped = 0;

    for (const message of args.messages) {
      const existing = await ctx.db
        .query("signals")
        .withIndex("by_sourceMessageId", (q) =>
          q
            .eq("tenantKey", args.tenantKey)
            .eq("connectorId", args.connectorId)
            .eq("sourceMessageId", message.discord_message_id),
        )
        .first();

      const fields = messageEventToSignalFields(message as any, {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
      });

      if (!existing) {
        await ctx.db.insert("signals", fields as any);
        accepted += 1;
        continue;
      }

      deduped += 1;
      await ctx.db.patch(existing._id, fields as any);
    }

    return { accepted, deduped };
  },
});

export const ingestChannelGuildSync = internalMutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guilds: v.array(IngestGuild),
    channels: v.array(IngestChannel),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const guild of args.guilds) {
      const existing = await ctx.db
        .query("discordGuilds")
        .withIndex("by_tenant_connector_guildId", (q) =>
          q
            .eq("tenantKey", args.tenantKey)
            .eq("connectorId", args.connectorId)
            .eq("guildId", guild.discord_guild_id),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("discordGuilds", {
          tenantKey: args.tenantKey,
          connectorId: args.connectorId,
          guildId: guild.discord_guild_id,
          name: guild.name,
          updatedAt: args.receivedAt,
        });
      } else {
        await ctx.db.patch(existing._id, {
          name: guild.name,
          updatedAt: args.receivedAt,
        });
      }
    }

    for (const channel of args.channels) {
      const existing = await ctx.db
        .query("discordChannels")
        .withIndex("by_tenant_connector_channelId", (q) =>
          q
            .eq("tenantKey", args.tenantKey)
            .eq("connectorId", args.connectorId)
            .eq("channelId", channel.discord_channel_id),
        )
        .first();

      const patch = {
        guildId: channel.guild_id,
        name: channel.name,
        ...(typeof channel.type === "number" ? { type: channel.type } : {}),
        ...(typeof channel.parent_id === "string"
          ? { parentId: channel.parent_id }
          : {}),
        ...(typeof channel.position === "number" ? { position: channel.position } : {}),
        updatedAt: args.receivedAt,
      };

      if (!existing) {
        await ctx.db.insert("discordChannels", {
          tenantKey: args.tenantKey,
          connectorId: args.connectorId,
          channelId: channel.discord_channel_id,
          ...patch,
        });
      } else {
        await ctx.db.patch(existing._id, patch);
      }
    }

    return { ok: true };
  },
});

export const ingestThread = internalMutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    event: IngestThreadEvent,
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const threadId = args.event.thread.discord_thread_id;

    const existing = await ctx.db
      .query("threads")
      .withIndex("by_tenant_connector_threadId", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("threadId", threadId),
      )
      .first();

    const patch = {
      parentChannelId: args.event.thread.parent_channel_id,
      guildId: args.event.thread.guild_id,
      name: args.event.thread.name,
      archived: Boolean(args.event.thread.archived),
      locked: Boolean(args.event.thread.locked),
      memberCount:
        typeof args.event.thread.member_count === "number"
          ? args.event.thread.member_count
          : undefined,
      messageCount:
        typeof args.event.thread.message_count === "number"
          ? args.event.thread.message_count
          : undefined,
      updatedAt: args.receivedAt,
      deletedAt: args.event.event_type === "delete" ? args.receivedAt : undefined,
    };

    if (!existing) {
      await ctx.db.insert("threads", {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        threadId,
        ...patch,
      });
      return { ok: true };
    }

    await ctx.db.patch(existing._id, patch);
    return { ok: true };
  },
});
