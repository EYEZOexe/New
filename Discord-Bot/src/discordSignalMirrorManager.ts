import {
  Client,
  DiscordAPIError,
  RESTJSONErrorCodes,
} from "discord.js";
import type { APIEmbed, Channel, Message } from "discord.js";

import type { ClaimedSignalMirrorJob } from "./convexSignalMirrorClient";

export type SignalMirrorExecutionResult = {
  ok: boolean;
  message: string;
  mirroredMessageId?: string;
  mirroredExtraMessageIds?: string[];
  mirroredGuildId?: string;
};

type MessageCapableChannel = Channel & {
  send: (payload: { content?: string; embeds?: APIEmbed[] }) => Promise<Message>;
  messages: {
    fetch: (messageId: string) => Promise<Message>;
  };
  guildId?: string | null;
};

export class DiscordSignalMirrorManager {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async executeJob(job: ClaimedSignalMirrorJob): Promise<SignalMirrorExecutionResult> {
    const channel = await this.client.channels
      .fetch(job.targetChannelId)
      .catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        if (parsed.code === RESTJSONErrorCodes.UnknownChannel) {
          return null;
        }
        throw error;
      });

    if (!channel) {
      return {
        ok: false,
        message: `target_channel_not_found:${job.targetChannelId}`,
      };
    }

    if (!supportsMessageOps(channel)) {
      return {
        ok: false,
        message: `unsupported_target_channel:${job.targetChannelId}`,
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
            throw error;
          });
        if (!existingMessage) continue;
        await existingMessage.delete();
      }
      return {
        ok: true,
        message: "messages_deleted",
        mirroredMessageId: existingMessageId || undefined,
        mirroredExtraMessageIds: [],
        mirroredGuildId: guildId,
      };
    }

    const payload = buildMirroredPayload(job.content, job.attachments);
    const sendOrEditPayload: { content?: string; embeds?: APIEmbed[] } = {
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
          throw error;
        });

      if (existingMessage) {
        upsertedMessage = await existingMessage.edit(sendOrEditPayload);
      }
    }

    if (!upsertedMessage) {
      upsertedMessage = await channel.send(sendOrEditPayload);
    }

    for (const messageId of existingExtraMessageIds) {
      const oldMessage = await channel.messages
        .fetch(messageId)
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
            return null;
          }
          throw error;
        });
      if (!oldMessage) continue;
      await oldMessage.delete();
    }

    const mirroredExtraMessageIds: string[] = [];
    for (const imageUrl of payload.extraImageUrls) {
      const imageMessage = await channel.send({ content: imageUrl });
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
}

function supportsMessageOps(channel: Channel): channel is MessageCapableChannel {
  const maybe = channel as unknown as Partial<MessageCapableChannel>;
  return (
    typeof maybe.send === "function" &&
    typeof maybe.messages?.fetch === "function"
  );
}

function buildMirroredPayload(
  content: string,
  attachments: Array<{
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

  if (error instanceof DiscordAPIError) {
    return {
      code: normalizeCode(error.code),
      status: error.status,
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
      message: error.message,
    };
  }

  return {
    code: null,
    status: null,
    message: String(error),
  };
}
