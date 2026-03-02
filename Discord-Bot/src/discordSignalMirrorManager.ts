import {
  Client,
  DiscordAPIError,
  RESTJSONErrorCodes,
} from "discord.js";
import type { APIAllowedMentions, APIEmbed, Channel, Message } from "discord.js";

import type { ClaimedSignalMirrorJob } from "./convexSignalMirrorClient";
import type { DiscordMirrorOwnershipCache } from "./discordMirrorOwnershipCache";
import { logWarn } from "./logger";

export type SignalMirrorExecutionResult = {
  ok: boolean;
  message: string;
  mirroredMessageId?: string;
  mirroredExtraMessageIds?: string[];
  mirroredGuildId?: string;
};

type MessageCapableChannel = Channel & {
  send: (payload: MirrorMessagePayload) => Promise<Message>;
  messages: {
    fetch: (messageId: string) => Promise<Message>;
    edit: (messageId: string, payload: MirrorMessagePayload) => Promise<Message>;
    delete: (messageId: string) => Promise<void>;
  };
  guildId?: string | null;
};

type MirrorMessagePayload = {
  content?: string;
  embeds?: APIEmbed[];
  allowedMentions?: APIAllowedMentions;
};

type RoleMentionSanitizationResult = {
  content: string;
  removedRoleIds: string[];
};

type MirrorOwnershipLookup = Pick<
  DiscordMirrorOwnershipCache,
  "isReady" | "hasGuild" | "hasRole" | "hasRoleInGuild"
>;

class MirrorOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MirrorOperationError";
  }
}

export class DiscordSignalMirrorManager {
  private readonly client: Client;
  private readonly ownershipLookup: MirrorOwnershipLookup | null;

  constructor(
    client: Client,
    args?: {
      ownershipLookup?: MirrorOwnershipLookup;
    },
  ) {
    this.client = client;
    this.ownershipLookup = args?.ownershipLookup ?? null;
  }

  async executeJob(job: ClaimedSignalMirrorJob): Promise<SignalMirrorExecutionResult> {
    const startedAt = Date.now();
    let channelFetchMs = 0;
    let upsertMs = 0;
    let cleanupMs = 0;
    let extraImageSendMs = 0;
    const sanitizedForeignReferences =
      job.eventType === "delete"
        ? {
            content: job.content,
            removedEventGuildIds: [] as string[],
            removedRoleIds: [] as string[],
            removedGenericLinkCount: 0,
            removedUnityAcademyMentions: 0,
          }
        : this.sanitizeForeignReferences(job.content);
    if (
      sanitizedForeignReferences.removedEventGuildIds.length > 0 ||
      sanitizedForeignReferences.removedRoleIds.length > 0 ||
      sanitizedForeignReferences.removedGenericLinkCount > 0 ||
      sanitizedForeignReferences.removedUnityAcademyMentions > 0
    ) {
      logWarn(
        `[mirror] stripped content references source_message=${job.sourceMessageId} target_channel=${job.targetChannelId} event_guilds=${sanitizedForeignReferences.removedEventGuildIds.join(",") || "none"} roles=${sanitizedForeignReferences.removedRoleIds.join(",") || "none"} generic_links=${sanitizedForeignReferences.removedGenericLinkCount} unity_mentions=${sanitizedForeignReferences.removedUnityAcademyMentions}`,
      );
    }

    const channelFetchStartedAt = Date.now();
    const cachedChannel =
      (
        this.client.channels as
          | { cache?: { get: (channelId: string) => Channel | undefined } }
          | undefined
      )?.cache?.get(job.targetChannelId) ?? null;
    const channel = cachedChannel
      ? cachedChannel
      : await this.client.channels.fetch(job.targetChannelId).catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownChannel) {
            return null;
          }
          throw new MirrorOperationError(classifyDiscordError(parsed, "channel_fetch_failed"));
        });
    channelFetchMs = Date.now() - channelFetchStartedAt;

    if (!channel) {
      return {
        ok: false,
        message: `terminal:target_channel_not_found:${job.targetChannelId}`,
      };
    }

    if (!supportsMessageOps(channel)) {
      return {
        ok: false,
        message: `terminal:unsupported_target_channel:${job.targetChannelId}`,
      };
    }

    const guildId = channel.guildId ?? undefined;
    const existingMessageId = job.existingMirroredMessageId?.trim() || "";
    const existingExtraMessageIds = (job.existingMirroredExtraMessageIds ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (job.eventType === "delete") {
      const deleteStartedAt = Date.now();
      const idsToDelete = [
        ...(existingMessageId ? [existingMessageId] : []),
        ...existingExtraMessageIds,
      ];
      if (idsToDelete.length === 0) {
        return {
          ok: true,
          message: "delete_no_existing_messages",
          mirroredExtraMessageIds: [],
          mirroredGuildId: guildId,
        };
      }
      for (const messageId of idsToDelete) {
        await channel.messages
          .delete(messageId)
          .catch((error: unknown) => {
            const parsed = parseDiscordError(error);
            if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
              return;
            }
            throw new MirrorOperationError(classifyDiscordError(parsed, "message_delete_failed"));
          });
      }
      cleanupMs = Date.now() - deleteStartedAt;
      console.info(
        `[mirror] discord timing source_message=${job.sourceMessageId} event=${job.eventType} target_channel=${job.targetChannelId} channel_fetch_ms=${channelFetchMs} upsert_ms=${upsertMs} cleanup_ms=${cleanupMs} extra_image_send_ms=${extraImageSendMs} total_ms=${Date.now() - startedAt}`,
      );
      return {
        ok: true,
        message: "messages_deleted",
        mirroredMessageId: existingMessageId || undefined,
        mirroredExtraMessageIds: [],
        mirroredGuildId: guildId,
      };
    }

    const sanitizedContent = await this.sanitizeRoleMentions({
      content: sanitizedForeignReferences.content,
      guildId,
      sourceMessageId: job.sourceMessageId,
      targetChannelId: job.targetChannelId,
    });
    if (!sanitizedContent.content.trim()) {
      console.info(
        `[mirror] skipped empty signal body source_message=${job.sourceMessageId} event=${job.eventType} target_channel=${job.targetChannelId}`,
      );
      return {
        ok: true,
        message: "message_skipped_empty_body",
        mirroredMessageId: existingMessageId || undefined,
        mirroredExtraMessageIds: existingExtraMessageIds,
        mirroredGuildId: guildId,
      };
    }
    const payload = buildMirroredPayload(sanitizedContent.content, job.attachments);
    if (payload.totalImageCount > 0 || payload.removedAttachmentLinkCount > 0) {
      console.info(
        `[mirror] normalized attachments source_message=${job.sourceMessageId} target_channel=${job.targetChannelId} total_images=${payload.totalImageCount} convex_images=${payload.convexBackedImageCount} pending_convex_images=${payload.pendingConvexSyncImageCount} stripped_attachment_links=${payload.removedAttachmentLinkCount}`,
      );
    }
    const rolePingId = await this.resolveRolePingId({
      configuredRolePingId: job.rolePingId,
      guildId,
      sourceMessageId: job.sourceMessageId,
      targetChannelId: job.targetChannelId,
    });
    const editPayload: MirrorMessagePayload = {
      embeds: [payload.embed],
    };
    const sendPayload: MirrorMessagePayload = rolePingId
      ? {
          content: `<@&${rolePingId}>`,
          embeds: [payload.embed],
          allowedMentions: {
            parse: [],
            roles: [rolePingId],
          },
        }
      : {
          embeds: [payload.embed],
        };

    let upsertedMessage: Message | null = null;
    const upsertStartedAt = Date.now();
    if (existingMessageId) {
      upsertedMessage = await channel.messages
        .edit(existingMessageId, editPayload)
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
            return null;
          }
          throw new MirrorOperationError(classifyDiscordError(parsed, "message_edit_failed"));
        });
    }

    if (!upsertedMessage) {
      upsertedMessage = await channel.send(sendPayload).catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        throw new MirrorOperationError(classifyDiscordError(parsed, "message_send_failed"));
      });
    }
    upsertMs = Date.now() - upsertStartedAt;

    const cleanupStartedAt = Date.now();
    for (const messageId of existingExtraMessageIds) {
      await channel.messages
        .delete(messageId)
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
            return;
          }
          throw new MirrorOperationError(classifyDiscordError(parsed, "message_delete_failed"));
        });
    }
    cleanupMs = Date.now() - cleanupStartedAt;

    const mirroredExtraMessageIds: string[] = [];
    const extraSendStartedAt = Date.now();
    for (const imageUrl of payload.extraImageUrls) {
      const imageMessage = await channel
        .send({
          embeds: [
            {
              color: 0x2f3136,
              image: { url: imageUrl },
            },
          ],
        })
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          throw new MirrorOperationError(classifyDiscordError(parsed, "image_send_failed"));
        });
      mirroredExtraMessageIds.push(imageMessage.id);
    }
    extraImageSendMs = Date.now() - extraSendStartedAt;

    console.info(
      `[mirror] discord timing source_message=${job.sourceMessageId} event=${job.eventType} target_channel=${job.targetChannelId} channel_fetch_ms=${channelFetchMs} upsert_ms=${upsertMs} cleanup_ms=${cleanupMs} extra_image_send_ms=${extraImageSendMs} total_ms=${Date.now() - startedAt}`,
    );

    return {
      ok: true,
      message: existingMessageId ? "message_updated" : "message_created",
      mirroredMessageId: upsertedMessage.id,
      mirroredExtraMessageIds,
      mirroredGuildId: guildId,
    };
  }

  private async sanitizeRoleMentions(args: {
    content: string;
    guildId?: string;
    sourceMessageId: string;
    targetChannelId: string;
  }): Promise<RoleMentionSanitizationResult> {
    const mentionedRoleIds = extractRoleMentionIds(args.content);
    if (!args.guildId || mentionedRoleIds.length === 0) {
      return { content: args.content, removedRoleIds: [] };
    }
    const guildId = args.guildId;

    if (this.ownershipLookup && !this.ownershipLookup.isReady()) {
      return { content: args.content, removedRoleIds: [] };
    }

    const ownershipLookup = this.getReadyOwnershipLookup();
    if (ownershipLookup) {
      const removedRoleIds = mentionedRoleIds.filter(
        (roleId) => !ownershipLookup.hasRoleInGuild(guildId, roleId),
      );
      if (removedRoleIds.length === 0) {
        return { content: args.content, removedRoleIds: [] };
      }
      console.info(
        `[mirror] stripped missing role mentions guild=${guildId} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId} roles=${removedRoleIds.join(",")} mode=cache`,
      );
      return {
        content: stripMissingRoleMentions(args.content, removedRoleIds),
        removedRoleIds,
      };
    }

    const guild = await this.client.guilds.fetch(guildId).catch((error: unknown) => {
      const parsed = parseDiscordError(error);
      console.warn(
        `[mirror] skipped role mention validation guild=${guildId} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId} reason=${parsed.message}`,
      );
      return null;
    });

    if (!guild) {
      return { content: args.content, removedRoleIds: [] };
    }

    const removedRoleIds: string[] = [];
    for (const roleId of mentionedRoleIds) {
      const lookupResult = await guild.roles
        .fetch(roleId)
        .then(() => "exists" as const)
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownRole) {
            return "missing" as const;
          }
          console.warn(
            `[mirror] failed role mention lookup guild=${guild.id} role=${roleId} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId} reason=${parsed.message}`,
          );
          return "exists" as const;
        });

      if (lookupResult === "missing") {
        removedRoleIds.push(roleId);
      }
    }

    if (removedRoleIds.length === 0) {
      return { content: args.content, removedRoleIds: [] };
    }

    console.info(
      `[mirror] stripped missing role mentions guild=${guild.id} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId} roles=${removedRoleIds.join(",")}`,
    );

    return {
      content: stripMissingRoleMentions(args.content, removedRoleIds),
      removedRoleIds,
    };
  }

  private async resolveRolePingId(args: {
    configuredRolePingId: string | null;
    guildId?: string;
    sourceMessageId: string;
    targetChannelId: string;
  }): Promise<string | null> {
    const rolePingId = normalizeRoleId(args.configuredRolePingId);
    if (!rolePingId || !args.guildId) {
      return null;
    }

    if (this.ownershipLookup && !this.ownershipLookup.isReady()) {
      return null;
    }

    const ownershipLookup = this.getReadyOwnershipLookup();
    if (ownershipLookup) {
      if (!ownershipLookup.hasRoleInGuild(args.guildId, rolePingId)) {
        console.info(
          `[mirror] skipped missing role ping guild=${args.guildId} role=${rolePingId} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId} mode=cache`,
        );
        return null;
      }
      return rolePingId;
    }

    const guild = await this.client.guilds.fetch(args.guildId).catch((error: unknown) => {
      const parsed = parseDiscordError(error);
      console.warn(
        `[mirror] skipped role ping validation guild=${args.guildId} role=${rolePingId} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId} reason=${parsed.message}`,
      );
      return null;
    });
    if (!guild) {
      return null;
    }

    const lookupResult = await guild.roles
      .fetch(rolePingId)
      .then(() => "exists" as const)
      .catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        if (parsed.code === RESTJSONErrorCodes.UnknownRole) {
          return "missing" as const;
        }
        console.warn(
          `[mirror] failed role ping lookup guild=${guild.id} role=${rolePingId} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId} reason=${parsed.message}`,
        );
        return "exists" as const;
      });

    if (lookupResult === "missing") {
      console.info(
        `[mirror] skipped missing role ping guild=${guild.id} role=${rolePingId} source_message=${args.sourceMessageId} target_channel=${args.targetChannelId}`,
      );
      return null;
    }

    return rolePingId;
  }

  private sanitizeForeignReferences(content: string): {
    content: string;
    removedEventGuildIds: string[];
    removedRoleIds: string[];
    removedGenericLinkCount: number;
    removedUnityAcademyMentions: number;
  } {
    const removedUnityAcademyMentions = countUnityAcademyMentions(content);
    const contentWithoutUnityAcademy = stripUnityAcademyMentions(content);
    const foreignEventGuildIds = this.extractForeignEventGuildIds(content);
    const foreignRoleIds = this.extractForeignRoleIds(content);
    const contentWithoutForeignEvents = stripForeignEventLinks(
      contentWithoutUnityAcademy,
      foreignEventGuildIds,
    );
    const contentWithoutForeignRoles = stripRoleReferences(
      contentWithoutForeignEvents,
      foreignRoleIds,
    );
    const removedGenericLinkCount = countGenericLinks(contentWithoutForeignRoles);
    const contentWithoutGenericLinks = stripGenericLinks(contentWithoutForeignRoles);
    return {
      content: contentWithoutGenericLinks,
      removedEventGuildIds: foreignEventGuildIds,
      removedRoleIds: foreignRoleIds,
      removedGenericLinkCount,
      removedUnityAcademyMentions,
    };
  }

  private extractForeignEventGuildIds(content: string): string[] {
    const guildIds = extractDiscordEventGuildIds(content);
    if (guildIds.length === 0) {
      return [];
    }
    if (this.ownershipLookup && !this.ownershipLookup.isReady()) {
      return [];
    }
    const ownershipLookup = this.getReadyOwnershipLookup();
    if (ownershipLookup) {
      return guildIds.filter((guildId) => !ownershipLookup.hasGuild(guildId));
    }
    const guildCache = this.getGuildCache();
    if (!guildCache) {
      return [];
    }
    return guildIds.filter((guildId) => !guildCache.has(guildId));
  }

  private extractForeignRoleIds(content: string): string[] {
    const roleIds = extractRoleReferenceIds(content);
    if (roleIds.length === 0) {
      return [];
    }
    if (this.ownershipLookup && !this.ownershipLookup.isReady()) {
      return [];
    }

    const ownershipLookup = this.getReadyOwnershipLookup();
    if (ownershipLookup) {
      return roleIds.filter((roleId) => !ownershipLookup.hasRole(roleId));
    }

    const guildCache = this.getGuildCache();
    if (!guildCache) {
      return [];
    }

    const knownRoleIds = new Set<string>();
    for (const guild of guildCache.values()) {
      const roleCache = guild.roles?.cache;
      if (!hasKeyIterable(roleCache)) continue;
      for (const roleId of roleCache.keys()) {
        const normalizedRoleId = String(roleId).trim();
        if (normalizedRoleId) {
          knownRoleIds.add(normalizedRoleId);
        }
      }
    }

    if (knownRoleIds.size === 0) {
      return [];
    }

    return roleIds.filter((roleId) => !knownRoleIds.has(roleId));
  }

  private getGuildCache(): GuildCacheLike | null {
    const cache = (this.client.guilds as { cache?: unknown } | undefined)?.cache;
    if (!isGuildCacheLike(cache)) {
      return null;
    }
    return cache;
  }

  private getReadyOwnershipLookup(): MirrorOwnershipLookup | null {
    if (!this.ownershipLookup || !this.ownershipLookup.isReady()) {
      return null;
    }
    return this.ownershipLookup;
  }
}

type GuildWithRolesCache = {
  roles?: {
    cache?: unknown;
  };
};

type GuildCacheLike = {
  has: (guildId: string) => boolean;
  values: () => IterableIterator<GuildWithRolesCache>;
};

function isGuildCacheLike(value: unknown): value is GuildCacheLike {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as { has?: unknown; values?: unknown };
  return typeof maybe.has === "function" && typeof maybe.values === "function";
}

function hasKeyIterable(value: unknown): value is { keys: () => IterableIterator<string> } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as { keys?: unknown };
  return typeof maybe.keys === "function";
}

function supportsMessageOps(channel: Channel): channel is MessageCapableChannel {
  const maybe = channel as unknown as Partial<MessageCapableChannel>;
  return (
    typeof maybe.send === "function" &&
    typeof maybe.messages?.fetch === "function"
  );
}

function extractRoleMentionIds(content: string): string[] {
  const roleIds = new Set<string>();
  const roleMentionPattern = /<@&(\d{2,})>/g;
  for (const match of content.matchAll(roleMentionPattern)) {
    const roleId = match[1]?.trim() ?? "";
    if (roleId) {
      roleIds.add(roleId);
    }
  }
  return [...roleIds];
}

function extractRoleReferenceIds(content: string): string[] {
  const roleIds = new Set<string>(extractRoleMentionIds(content));
  const mappedRolePattern = /@role:(\d{2,})/gi;
  for (const match of content.matchAll(mappedRolePattern)) {
    const roleId = match[1]?.trim() ?? "";
    if (roleId) {
      roleIds.add(roleId);
    }
  }
  return [...roleIds];
}

function extractDiscordEventGuildIds(content: string): string[] {
  const guildIds = new Set<string>();
  const eventPattern =
    /(?:https?:\/\/)?(?:canary\.|ptb\.)?discord\.com\/events\/(\d{5,25})\/\d{5,25}\/\d{5,25}(?:[/?#]\S*)?/gi;
  for (const match of content.matchAll(eventPattern)) {
    const guildId = match[1]?.trim() ?? "";
    if (guildId) {
      guildIds.add(guildId);
    }
  }
  return [...guildIds];
}

function stripForeignEventLinks(content: string, guildIdsToRemove: string[]): string {
  if (guildIdsToRemove.length === 0) {
    return content;
  }
  const removalSet = new Set(
    guildIdsToRemove.map((guildId) => guildId.trim()).filter((guildId) => guildId.length > 0),
  );
  if (removalSet.size === 0) {
    return content;
  }

  const eventPattern =
    /(?:https?:\/\/)?(?:canary\.|ptb\.)?discord\.com\/events\/(\d{5,25})\/\d{5,25}\/\d{5,25}(?:[/?#]\S*)?/gi;
  const stripped = content.replace(eventPattern, (fullMatch, guildId: string) =>
    removalSet.has(guildId) ? "" : fullMatch,
  );
  return normalizeStrippedContent(stripped);
}

function stripRoleReferences(content: string, roleIdsToRemove: string[]): string {
  if (roleIdsToRemove.length === 0) {
    return content;
  }
  const withoutMentions = stripMissingRoleMentions(content, roleIdsToRemove);
  const removalSet = new Set(
    roleIdsToRemove.map((roleId) => roleId.trim()).filter((roleId) => roleId.length > 0),
  );
  if (removalSet.size === 0) {
    return withoutMentions;
  }
  const stripped = withoutMentions.replace(/@role:(\d{2,})/gi, (fullMatch, roleId: string) =>
    removalSet.has(roleId) ? "" : fullMatch,
  );
  return normalizeStrippedContent(stripped);
}

function normalizeRoleId(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (!/^\d{5,25}$/.test(normalized)) return null;
  return normalized;
}

function stripMissingRoleMentions(content: string, roleIdsToRemove: string[]): string {
  if (roleIdsToRemove.length === 0) {
    return content;
  }
  const removalSet = new Set(
    roleIdsToRemove.map((roleId) => roleId.trim()).filter((roleId) => roleId.length > 0),
  );
  if (removalSet.size === 0) {
    return content;
  }

  return content.replace(/<@&(\d{2,})>/g, (fullMatch, roleId: string) =>
    removalSet.has(roleId) ? "" : fullMatch,
  );
}

function normalizeStrippedContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripUnityAcademyMentions(content: string): string {
  return normalizeStrippedContent(content.replace(/\bunity\s+academy\b/gi, ""));
}

function countUnityAcademyMentions(content: string): number {
  const matches = content.match(/\bunity\s+academy\b/gi);
  return matches?.length ?? 0;
}

const GENERIC_LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+/gi;

function stripGenericLinks(content: string): string {
  return normalizeStrippedContent(content.replace(GENERIC_LINK_PATTERN, ""));
}

function countGenericLinks(content: string): number {
  const matches = content.match(GENERIC_LINK_PATTERN);
  return matches?.length ?? 0;
}

function buildMirroredPayload(
  content: string,
  attachments: Array<{
    attachmentId?: string;
    url: string;
    storageId?: string;
    mirrorUrl?: string;
    name?: string;
    contentType?: string;
  }>,
): {
  embed: APIEmbed;
  extraImageUrls: string[];
  totalImageCount: number;
  convexBackedImageCount: number;
  pendingConvexSyncImageCount: number;
  removedAttachmentLinkCount: number;
} {
  const normalizedContent = content.trim();
  const safeContent = normalizedContent || "(empty signal)";
  const description =
    safeContent.length > 4096 ? `${safeContent.slice(0, 4093)}...` : safeContent;

  const imageUrls: string[] = [];
  let convexBackedImageCount = 0;
  let pendingConvexSyncImageCount = 0;
  const nonImageLines: string[] = [];
  let attachmentCounter = 0;
  for (const attachment of attachments) {
    attachmentCounter += 1;
    const url = attachment.url?.trim();
    if (!url) continue;
    const mirrorUrl = attachment.mirrorUrl?.trim() ?? "";
    if (isLikelyImage(url, attachment.contentType)) {
      if (!mirrorUrl) {
        pendingConvexSyncImageCount += 1;
        continue;
      }
      imageUrls.push(mirrorUrl);
      if (mirrorUrl) {
        convexBackedImageCount += 1;
      }
      continue;
    }
    const name = attachment.name?.trim() || `Attachment ${attachmentCounter}`;
    nonImageLines.push(name);
  }

  const embed: APIEmbed = {
    title: "Signal",
    description,
    color: 0x2f3136,
  };

  if (nonImageLines.length > 0) {
    const value = nonImageLines.join("\n");
    embed.fields = [
      {
        name: "Attachments",
        value: value.length > 1024 ? `${value.slice(0, 1021)}...` : value,
      },
    ];
  }
  if (pendingConvexSyncImageCount > 0) {
    const pendingText =
      pendingConvexSyncImageCount === 1
        ? "1 image omitted until Convex media sync completes."
        : `${pendingConvexSyncImageCount} images omitted until Convex media sync completes.`;
    embed.fields = [
      ...(embed.fields ?? []),
      {
        name: "Images",
        value: pendingText,
      },
    ];
  }

  if (imageUrls.length === 1) {
    embed.image = { url: imageUrls[0] };
    if (pendingConvexSyncImageCount > 0) {
      embed.footer = {
        text:
          pendingConvexSyncImageCount === 1
            ? "1 image pending Convex sync"
            : `${pendingConvexSyncImageCount} images pending Convex sync`,
      };
    }
    return {
      embed,
      extraImageUrls: [],
      totalImageCount: imageUrls.length,
      convexBackedImageCount,
      pendingConvexSyncImageCount,
      removedAttachmentLinkCount: nonImageLines.length,
    };
  }

  if (imageUrls.length > 1) {
    const pendingSuffix =
      pendingConvexSyncImageCount > 0
        ? ` \u00b7 ${pendingConvexSyncImageCount} pending sync`
        : "";
    embed.footer = { text: `${imageUrls.length} images posted below${pendingSuffix}` };
  } else if (pendingConvexSyncImageCount > 0) {
    embed.footer = {
      text:
        pendingConvexSyncImageCount === 1
          ? "1 image pending Convex sync"
          : `${pendingConvexSyncImageCount} images pending Convex sync`,
    };
  }

  return {
    embed,
    extraImageUrls: imageUrls,
    totalImageCount: imageUrls.length,
    convexBackedImageCount,
    pendingConvexSyncImageCount,
    removedAttachmentLinkCount: nonImageLines.length,
  };
}

function isLikelyImage(url: string, contentType?: string): boolean {
  const normalizedType = contentType?.toLowerCase().trim();
  if (normalizedType?.startsWith("image/")) {
    return true;
  }

  const lower = url.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".bmp")
  );
}

function parseDiscordError(error: unknown): {
  code: number | null;
  status: number | null;
  retryAfterMs: number | null;
  message: string;
} {
  const normalizeCode = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const normalizeRetryAfterMs = (value: unknown): number | null => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    // discord.js may expose retryAfter in ms (large) or seconds (small).
    const ms = value > 300 ? value : value * 1000;
    return Math.ceil(ms);
  };

  if (error instanceof DiscordAPIError) {
    return {
      code: normalizeCode(error.code),
      status: error.status,
      retryAfterMs: normalizeRetryAfterMs((error as unknown as { retryAfter?: unknown }).retryAfter),
      message: error.message,
    };
  }

  if (error instanceof Error) {
    const maybeCode = normalizeCode((error as { code?: unknown }).code);
    const maybeStatus =
      typeof (error as { status?: unknown }).status === "number"
        ? ((error as { status?: number }).status ?? null)
        : null;
    return {
      code: maybeCode,
      status: maybeStatus,
      retryAfterMs: normalizeRetryAfterMs((error as { retryAfter?: unknown }).retryAfter),
      message: error.message,
    };
  }

  return {
    code: null,
    status: null,
    retryAfterMs: null,
    message: String(error),
  };
}

function classifyDiscordError(
  parsed: { code: number | null; status: number | null; retryAfterMs: number | null; message: string },
  fallback: string,
): string {
  const retryAfterMs =
    typeof parsed.retryAfterMs === "number" && Number.isFinite(parsed.retryAfterMs)
      ? Math.min(15 * 60 * 1000, Math.max(250, parsed.retryAfterMs))
      : null;
  if (parsed.status === 429 || retryAfterMs !== null) {
    return `retry_after_ms:${retryAfterMs ?? 1000}:${fallback}:${parsed.message}`;
  }

  const terminalCodes = new Set<number>([
    RESTJSONErrorCodes.MissingAccess,
    RESTJSONErrorCodes.MissingPermissions,
    RESTJSONErrorCodes.UnknownChannel,
    RESTJSONErrorCodes.UnknownGuild,
  ]);
  if (
    parsed.status === 401 ||
    parsed.status === 403 ||
    terminalCodes.has(parsed.code ?? Number.NaN)
  ) {
    return `terminal:${fallback}:${parsed.message}`;
  }

  return `${fallback}:${parsed.message}`;
}
