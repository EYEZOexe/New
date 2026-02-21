import { describe, expect, it } from "bun:test";
import { RESTJSONErrorCodes } from "discord.js";
import type { APIEmbed, Client, Message } from "discord.js";

import type { ClaimedSignalMirrorJob } from "../src/convexSignalMirrorClient";
import { DiscordSignalMirrorManager } from "../src/discordSignalMirrorManager";

function buildJob(content: string): ClaimedSignalMirrorJob {
  return {
    jobId: "job_1",
    claimToken: "claim_1",
    tenantKey: "tenant_1",
    connectorId: "connector_1",
    sourceMessageId: "source_message_1",
    sourceChannelId: "source_channel_1",
    sourceGuildId: "source_guild_1",
    targetChannelId: "target_channel_1",
    eventType: "create",
    content,
    attachments: [],
    sourceCreatedAt: 1,
    sourceEditedAt: null,
    sourceDeletedAt: null,
    attemptCount: 0,
    maxAttempts: 5,
    runAfter: 1,
    createdAt: 1,
    existingMirroredMessageId: null,
    existingMirroredExtraMessageIds: [],
    existingMirroredGuildId: null,
  };
}

function unknownRoleError(): Error & { code: number } {
  const error = new Error("Unknown Role") as Error & { code: number };
  error.code = RESTJSONErrorCodes.UnknownRole;
  return error;
}

describe("discord signal mirror manager", () => {
  it("removes missing role mentions while preserving valid mentions and message text", async () => {
    const sentPayloads: Array<{ content?: string; embeds?: APIEmbed[] }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: { content?: string; embeds?: APIEmbed[] }) => {
        sentPayloads.push(payload);
        return { id: `mirrored_${sentPayloads.length}` } as unknown as Message;
      },
      messages: {
        fetch: async () => {
          throw new Error("unexpected_message_fetch");
        },
      },
    };
    const guild = {
      id: "target_guild_1",
      roles: {
        fetch: async (roleId: string) => {
          if (roleId === "222222222222222222") {
            throw unknownRoleError();
          }
          return { id: roleId };
        },
      },
    };

    const client = {
      channels: {
        fetch: async () => channel,
      },
      guilds: {
        fetch: async () => guild,
      },
    } as unknown as Client;

    const manager = new DiscordSignalMirrorManager(client);
    const result = await manager.executeJob(
      buildJob("Signal alert <@&111111111111111111> entry now <@&222222222222222222>"),
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe("message_created");
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].embeds?.[0]?.description).toBe(
      "Signal alert <@&111111111111111111> entry now",
    );
  });
});
