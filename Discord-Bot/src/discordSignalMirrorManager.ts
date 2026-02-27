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
    const sanitizedForeignReferences =
      job.eventType === "delete"
        ? {
            content: job.content,
            removedEventGuildIds: [] as string[],
            removedRoleIds: [] as string[],
          }
        : this.sanitizeForeignReferences(job.content);
    if (
      sanitizedForeignReferences.removedEventGuildIds.length > 0 ||
      sanitizedForeignReferences.removedRoleIds.length > 0
    ) {
      logWarn(
        `[mirror] stripped foreign references source_message=${job.sourceMessageId} target_channel=${job.targetChannelId} event_guilds=${sanitizedForeignReferences.removedEventGuildIds.join(",") || "none"} roles=${sanitizedForeignReferences.removedRoleIds.join(",") || "none"}`,
      );
    }

    const channel = await this.client.channels
      .fetch(job.targetChannelId)
      .catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        if (parsed.code === RESTJSONErrorCodes.UnknownChannel) {
          return null;
        }
        throw new MirrorOperationError(classifyDiscordError(parsed, "channel_fetch_failed"));
      });

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
        const existingMessage = await channel.messages
          .fetch(messageId)
          .catch((error: unknown) => {
            const parsed = parseDiscordError(error);
            if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
              return null;
            }
            throw new MirrorOperationError(classifyDiscordError(parsed, "message_fetch_failed"));
          });
        if (!existingMessage) continue;
        await existingMessage.delete().catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          throw new MirrorOperationError(classifyDiscordError(parsed, "message_delete_failed"));
        });
      }
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
    const payload = buildMirroredPayload(sanitizedContent.content, job.attachments);
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
    if (existingMessageId) {
      const existingMessage = await channel.messages
        .fetch(existingMessageId)
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
            return null;
          }
          throw new MirrorOperationError(classifyDiscordError(parsed, "message_fetch_failed"));
        });

      if (existingMessage) {
        upsertedMessage = await existingMessage.edit(editPayload).catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          throw new MirrorOperationError(classifyDiscordError(parsed, "message_edit_failed"));
        });
      }
    }

    if (!upsertedMessage) {
      upsertedMessage = await channel.send(sendPayload).catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        throw new MirrorOperationError(classifyDiscordError(parsed, "message_send_failed"));
      });
    }

    for (const messageId of existingExtraMessageIds) {
      const oldMessage = await channel.messages
        .fetch(messageId)
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
            return null;
          }
          throw new MirrorOperationError(classifyDiscordError(parsed, "message_fetch_failed"));
        });
      if (!oldMessage) continue;
      await oldMessage.delete().catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        throw new MirrorOperationError(classifyDiscordError(parsed, "message_delete_failed"));
      });
    }

    const mirroredExtraMessageIds: string[] = [];
    for (const imageUrl of payload.extraImageUrls) {
      const imageMessage = await channel.send({ content: imageUrl }).catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        throw new MirrorOperationError(classifyDiscordError(parsed, "image_send_failed"));
      });
      mirroredExtraMessageIds.push(imageMessage.id);
    }

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
  } {
    const foreignEventGuildIds = this.extractForeignEventGuildIds(content);
    const foreignRoleIds = this.extractForeignRoleIds(content);
    const contentWithoutForeignEvents = stripForeignEventLinks(content, foreignEventGuildIds);
    const contentWithoutForeignRoles = stripRoleReferences(
      contentWithoutForeignEvents,
      foreignRoleIds,
    );
    return {
      content: contentWithoutForeignRoles,
      removedEventGuildIds: foreignEventGuildIds,
      removedRoleIds: foreignRoleIds,
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
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
}

function buildMirroredPayload(
  content: string,
  attachments: Array<{
    attachmentId?: string;
    url: string;
    name?: string;
    contentType?: string;
  }>,
): {
  embed: APIEmbed;
  extraImageUrls: string[];
} {
  const normalizedContent = content.trim();
  const safeContent = normalizedContent || "(empty signal)";
  const description =
    safeContent.length > 4096 ? `${safeContent.slice(0, 4093)}...` : safeContent;

  const imageUrls: string[] = [];
  const nonImageLines: string[] = [];
  for (const attachment of attachments) {
    const url = attachment.url?.trim();
    if (!url) continue;
    if (isLikelyImage(url, attachment.contentType)) {
      imageUrls.push(url);
      continue;
    }
    const name = attachment.name?.trim();
    nonImageLines.push(name ? `[${name}](${url})` : url);
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

  if (imageUrls.length === 1) {
    embed.image = { url: imageUrls[0] };
    return { embed, extraImageUrls: [] };
  }

  if (imageUrls.length > 1) {
    embed.footer = { text: `${imageUrls.length} images posted below` };
  }

  return { embed, extraImageUrls: imageUrls };
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
