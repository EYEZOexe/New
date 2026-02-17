import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { resolveAttachmentsForExistingSignalPatch } from "./ingestAttachmentMerge";
import { messageEventToSignalFields } from "./ingestUtils";
import { enqueueMirrorJobsForSignal } from "./mirrorQueue";

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
    auto_archive_duration: v.optional(v.union(v.number(), v.null())),
    archive_timestamp: v.optional(v.union(v.string(), v.null())),
    message_count: v.optional(v.union(v.number(), v.null())),
    member_count: v.optional(v.union(v.number(), v.null())),
    rate_limit_per_user: v.optional(v.union(v.number(), v.null())),
    owner_id: v.optional(v.union(v.string(), v.null())),
    owner_username: v.optional(v.union(v.string(), v.null())),
    owner_global_name: v.optional(v.union(v.string(), v.null())),
    last_message_id: v.optional(v.union(v.string(), v.null())),
    last_message_at: v.optional(v.union(v.string(), v.null())),
    created_timestamp: v.optional(v.union(v.string(), v.null())),
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
    const connector = await ctx.db
      .query("connectors")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .first();
    const forwardingEnabled = connector?.forwardEnabled === true;

    const mirrorTargetsBySourceChannel = new Map<string, string[]>();
    if (forwardingEnabled) {
      const mappings = await ctx.db
        .query("connectorMappings")
        .withIndex("by_tenant_connectorId", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .collect();

      for (const mapping of mappings) {
        const sourceChannelId = mapping.sourceChannelId.trim();
        const targetChannelId = mapping.targetChannelId.trim();
        if (!sourceChannelId || !targetChannelId) continue;
        const current = mirrorTargetsBySourceChannel.get(sourceChannelId) ?? [];
        current.push(targetChannelId);
        mirrorTargetsBySourceChannel.set(sourceChannelId, current);
      }
    }

    let accepted = 0;
    let deduped = 0;
    let ignored = 0;
    let attachmentRefsPersisted = 0;
    let mirrorEnqueued = 0;
    let mirrorDeduped = 0;
    let mirrorSkipped = 0;

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
      }, {
        receivedAt: args.receivedAt,
      });

      let mirrorContent = fields.content;
      let mirrorAttachments = fields.attachments;

      if (!existing) {
        await ctx.db.insert("signals", fields as any);
        accepted += 1;
        attachmentRefsPersisted += fields.attachments.length;
      } else {
        deduped += 1;

        if (typeof existing.deletedAt === "number" && message.event_type !== "delete") {
          const incomingEventAt = fields.editedAt ?? fields.createdAt;
          if (incomingEventAt <= existing.deletedAt) {
            ignored += 1;
            continue;
          }
        }

        const patch: Record<string, unknown> = {
          sourceChannelId: fields.sourceChannelId,
          sourceGuildId: fields.sourceGuildId,
          createdAt: fields.createdAt,
        };

        const attachmentResolution = resolveAttachmentsForExistingSignalPatch({
          eventType: message.event_type,
          incomingAttachments: fields.attachments,
          existingAttachments: existing.attachments,
        });

        if (message.event_type === "delete") {
          patch.deletedAt = fields.deletedAt ?? args.receivedAt;
          patch.content = fields.content || existing.content;
          if (attachmentResolution.attachments) {
            patch.attachments = attachmentResolution.attachments;
          }
        } else {
          patch.content = fields.content;
          patch.attachments = attachmentResolution.attachments;

          if (message.event_type === "update") {
            patch.editedAt = fields.editedAt ?? args.receivedAt;
          } else if (typeof fields.editedAt === "number") {
            patch.editedAt = fields.editedAt;
          }

          if (typeof fields.deletedAt === "number") {
            patch.deletedAt = fields.deletedAt;
          }
        }

        if (attachmentResolution.preservedExisting) {
          console.info(
            `[ingest] preserved existing attachment refs for sparse event tenant=${args.tenantKey} connector=${args.connectorId} message=${fields.sourceMessageId} event=${message.event_type} existing_refs=${Array.isArray(existing.attachments) ? existing.attachments.length : 0}`,
          );
        }

        await ctx.db.patch(existing._id, patch as any);

        const patchedAttachments = Array.isArray(patch.attachments)
          ? (patch.attachments as Array<{
              attachmentId?: string;
              url: string;
              name?: string;
              contentType?: string;
              size?: number;
            }>)
          : fields.attachments;

        attachmentRefsPersisted += patchedAttachments.length;
        mirrorContent = patch.content ? String(patch.content) : existing.content;
        mirrorAttachments = patchedAttachments;
      }

      if (!forwardingEnabled) continue;

      const targetChannelIds =
        mirrorTargetsBySourceChannel.get(fields.sourceChannelId) ?? [];
      if (targetChannelIds.length === 0) continue;

      const mirrorResult = await enqueueMirrorJobsForSignal(ctx, {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        sourceMessageId: fields.sourceMessageId,
        sourceChannelId: fields.sourceChannelId,
        sourceGuildId: fields.sourceGuildId,
        targetChannelIds,
        eventType: message.event_type,
        content: mirrorContent,
        attachments: mirrorAttachments,
        sourceCreatedAt: fields.createdAt,
        sourceEditedAt: fields.editedAt,
        sourceDeletedAt: fields.deletedAt,
        now: args.receivedAt,
      });
      mirrorEnqueued += mirrorResult.enqueued;
      mirrorDeduped += mirrorResult.deduped;
      mirrorSkipped += mirrorResult.skipped;
    }

    console.info(
      `[ingest] signal batch processed tenant=${args.tenantKey} connector=${args.connectorId} accepted=${accepted} deduped=${deduped} ignored=${ignored} attachment_refs=${attachmentRefsPersisted} mirror_enqueued=${mirrorEnqueued} mirror_deduped=${mirrorDeduped} mirror_skipped=${mirrorSkipped} total=${args.messages.length}`,
    );

    return {
      accepted,
      deduped,
      ignored,
      attachmentRefsPersisted,
      mirrorEnqueued,
      mirrorDeduped,
      mirrorSkipped,
    };
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
