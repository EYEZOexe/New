import {
  Client,
  DiscordAPIError,
  RESTJSONErrorCodes,
} from "discord.js";
import type { Channel, Message } from "discord.js";

import type { ClaimedSignalMirrorJob } from "./convexSignalMirrorClient";

export type SignalMirrorExecutionResult = {
  ok: boolean;
  message: string;
  mirroredMessageId?: string;
  mirroredGuildId?: string;
};

type MessageCapableChannel = Channel & {
  send: (payload: { content: string }) => Promise<Message>;
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
    const content = buildMirroredContent(job.content, job.attachments);

    if (job.eventType === "delete") {
      if (!existingMessageId) {
        return {
          ok: true,
          message: "delete_no_existing_message",
          mirroredGuildId: guildId,
        };
      }
      const existingMessage = await channel.messages
        .fetch(existingMessageId)
        .catch((error: unknown) => {
          const parsed = parseDiscordError(error);
          if (parsed.code === RESTJSONErrorCodes.UnknownMessage) {
            return null;
          }
          throw error;
        });

      if (!existingMessage) {
        return {
          ok: true,
          message: "delete_target_message_missing",
          mirroredGuildId: guildId,
        };
      }

      await existingMessage.delete();
      return {
        ok: true,
        message: "message_deleted",
        mirroredMessageId: existingMessage.id,
        mirroredGuildId: guildId,
      };
    }

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
        const edited = await existingMessage.edit({ content });
        return {
          ok: true,
          message: "message_updated",
          mirroredMessageId: edited.id,
          mirroredGuildId: guildId,
        };
      }
    }

    const created = await channel.send({ content });
    return {
      ok: true,
      message: "message_created",
      mirroredMessageId: created.id,
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

function buildMirroredContent(
  content: string,
  attachments: Array<{ url: string }>,
): string {
  const normalized = content.trim();
  const attachmentUrls = attachments
    .map((attachment) => attachment.url.trim())
    .filter((url) => url.length > 0);

  let combined = normalized;
  if (attachmentUrls.length > 0) {
    const attachmentBlock = attachmentUrls.join("\n");
    combined = combined
      ? `${combined}\n\nAttachments:\n${attachmentBlock}`
      : `Attachments:\n${attachmentBlock}`;
  }

  if (!combined) {
    combined = "(empty signal)";
  }

  // Discord message content hard limit is 2000 characters.
  return combined.length > 2000 ? `${combined.slice(0, 1997)}...` : combined;
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
