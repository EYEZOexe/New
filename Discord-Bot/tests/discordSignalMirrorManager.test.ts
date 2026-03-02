import { describe, expect, it } from "bun:test";
import { RESTJSONErrorCodes } from "discord.js";
import type { APIEmbed, Client, Message } from "discord.js";

import type { ClaimedSignalMirrorJob } from "../src/convexSignalMirrorClient";
import { DiscordMirrorOwnershipCache } from "../src/discordMirrorOwnershipCache";
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
    rolePingId: null,
  };
}

function unknownRoleError(): Error & { code: number } {
  const error = new Error("Unknown Role") as Error & { code: number };
  error.code = RESTJSONErrorCodes.UnknownRole;
  return error;
}

describe("discord signal mirror manager", () => {
  it("strips generic links and Unity Academy mentions from mirrored message text", async () => {
    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
        sentPayloads.push(payload);
        return { id: `mirrored_${sentPayloads.length}` } as unknown as Message;
      },
      messages: {
        fetch: async () => {
          throw new Error("unexpected_message_fetch");
        },
      },
    };
    const client = {
      channels: {
        fetch: async () => channel,
      },
      guilds: {
        cache: new Map([
          [
            "1087843967573438504",
            {
              roles: {
                cache: new Map<string, { id: string }>(),
              },
            },
          ],
        ]),
      },
    } as unknown as Client;

    const manager = new DiscordSignalMirrorManager(client);
    const result = await manager.executeJob(
      buildJob("Unity Academy alpha https://example.com/charts keep this live"),
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe("message_created");
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].embeds?.[0]?.description).toBe("alpha keep this live");
  });

  it("posts extra images as embeds without raw link-only messages", async () => {
    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
        sentPayloads.push(payload);
        return { id: `mirrored_${sentPayloads.length}` } as unknown as Message;
      },
      messages: {
        fetch: async () => {
          throw new Error("unexpected_message_fetch");
        },
      },
    };

    const client = {
      channels: {
        fetch: async () => channel,
      },
      guilds: {
        cache: new Map([
          [
            "1087843967573438504",
            {
              roles: {
                cache: new Map<string, { id: string }>(),
              },
            },
          ],
        ]),
      },
    } as unknown as Client;

    const manager = new DiscordSignalMirrorManager(client);
    const result = await manager.executeJob({
      ...buildJob("Signal with image set"),
      attachments: [
        {
          attachmentId: "att-1",
          url: "https://cdn.discordapp.com/image-a.png",
          mirrorUrl: "https://convex.example/storage/image-a",
          contentType: "image/png",
        },
        {
          attachmentId: "att-2",
          url: "https://cdn.discordapp.com/image-b.png",
          mirrorUrl: "https://convex.example/storage/image-b",
          contentType: "image/png",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe("message_created");
    expect(sentPayloads).toHaveLength(3);
    expect(sentPayloads[0].embeds?.[0]?.footer?.text).toBe("2 images posted below");
    expect(sentPayloads[1].content).toBeUndefined();
    expect(sentPayloads[1].embeds?.[0]?.image?.url).toBe("https://convex.example/storage/image-a");
    expect(sentPayloads[2].content).toBeUndefined();
    expect(sentPayloads[2].embeds?.[0]?.image?.url).toBe("https://convex.example/storage/image-b");
  });

  it("omits image attachments that are not hydrated to Convex URLs", async () => {
    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
        sentPayloads.push(payload);
        return { id: `mirrored_${sentPayloads.length}` } as unknown as Message;
      },
      messages: {
        fetch: async () => {
          throw new Error("unexpected_message_fetch");
        },
      },
    };

    const client = {
      channels: {
        fetch: async () => channel,
      },
      guilds: {
        cache: new Map([
          [
            "1087843967573438504",
            {
              roles: {
                cache: new Map<string, { id: string }>(),
              },
            },
          ],
        ]),
      },
    } as unknown as Client;

    const manager = new DiscordSignalMirrorManager(client);
    const result = await manager.executeJob({
      ...buildJob("Signal image pending sync"),
      attachments: [
        {
          attachmentId: "att-1",
          url: "https://cdn.discordapp.com/image-a.png",
          contentType: "image/png",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe("message_created");
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].embeds?.[0]?.image?.url).toBeUndefined();
    expect(sentPayloads[0].embeds?.[0]?.fields?.[0]?.name).toBe("Images");
    expect(sentPayloads[0].embeds?.[0]?.fields?.[0]?.value).toBe(
      "1 image omitted until Convex media sync completes.",
    );
  });

  it("strips foreign Discord event links and mirrors the remaining message text", async () => {
    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
        sentPayloads.push(payload);
        return { id: `mirrored_${sentPayloads.length}` } as unknown as Message;
      },
      messages: {
        fetch: async () => {
          throw new Error("unexpected_message_fetch");
        },
      },
    };
    const client = {
      channels: {
        fetch: async () => channel,
      },
      guilds: {
        cache: new Map([
          [
            "1087843967573438504",
            {
              roles: {
                cache: new Map<string, { id: string }>(),
              },
            },
          ],
        ]),
      },
    } as unknown as Client;

    const manager = new DiscordSignalMirrorManager(client);
    const result = await manager.executeJob(
      buildJob(
        "Signal https://discord.com/events/999999999999999999/1390441633807501685/1476994793472000000 hello team",
      ),
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe("message_created");
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].embeds?.[0]?.description).toBe("Signal hello team");
  });

  it("strips foreign role tokens and mirrors the remaining message text", async () => {
    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
        sentPayloads.push(payload);
        return { id: `mirrored_${sentPayloads.length}` } as unknown as Message;
      },
      messages: {
        fetch: async () => {
          throw new Error("unexpected_message_fetch");
        },
      },
    };
    const client = {
      channels: {
        fetch: async () => channel,
      },
      guilds: {
        cache: new Map([
          [
            "1087843967573438504",
            {
              roles: {
                cache: new Map([["111111111111111111", { id: "111111111111111111" }]]),
              },
            },
          ],
        ]),
      },
    } as unknown as Client;

    const manager = new DiscordSignalMirrorManager(client);
    const result = await manager.executeJob(
      buildJob("@role:222222222222222222 hello how are you all?"),
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe("message_created");
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].embeds?.[0]?.description).toBe("hello how are you all?");
  });

  it("uses ownership cache for role validation without guild fetch on mirror path", async () => {
    const ownershipCache = new DiscordMirrorOwnershipCache();
    ownershipCache.applySnapshots({
      allGuildIds: ["target_guild_1"],
      roleSnapshots: [
        {
          guildId: "target_guild_1",
          roleIds: ["111111111111111111"],
        },
      ],
    });

    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
        sentPayloads.push(payload);
        return { id: `mirrored_${sentPayloads.length}` } as unknown as Message;
      },
      messages: {
        fetch: async () => {
          throw new Error("unexpected_message_fetch");
        },
      },
    };

    const client = {
      channels: {
        fetch: async () => channel,
      },
      guilds: {
        fetch: async () => {
          throw new Error("unexpected_guild_fetch");
        },
      },
    } as unknown as Client;

    const manager = new DiscordSignalMirrorManager(client, {
      ownershipLookup: ownershipCache,
    });
    const result = await manager.executeJob(
      {
        ...buildJob("Signal alert <@&111111111111111111>"),
        rolePingId: "111111111111111111",
      },
    );

    expect(result.ok).toBe(true);
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].content).toBe("<@&111111111111111111>");
    expect(sentPayloads[0].embeds?.[0]?.description).toBe("Signal alert <@&111111111111111111>");
  });

  it("adds configured role ping outside the embed when creating a mirrored message", async () => {
    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
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
        fetch: async () => ({ id: "111111111111111111" }),
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
    const result = await manager.executeJob({
      ...buildJob("Signal body"),
      rolePingId: "111111111111111111",
    });

    expect(result.ok).toBe(true);
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].content).toBe("<@&111111111111111111>");
    expect(sentPayloads[0].embeds?.[0]?.description).toBe("Signal body");
  });

  it("removes missing role mentions while preserving valid mentions and message text", async () => {
    const sentPayloads: Array<{
      content?: string;
      embeds?: APIEmbed[];
      allowedMentions?: { parse: string[]; roles: string[] };
    }> = [];
    const channel = {
      guildId: "target_guild_1",
      send: async (payload: {
        content?: string;
        embeds?: APIEmbed[];
        allowedMentions?: { parse: string[]; roles: string[] };
      }) => {
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
