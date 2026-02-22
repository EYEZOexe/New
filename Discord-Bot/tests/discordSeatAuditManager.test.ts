import { describe, expect, it } from "bun:test";
import { Collection, type Client } from "discord.js";

import type { ClaimedSeatAuditJob } from "../src/convexSeatAuditClient";
import { DiscordSeatAuditManager } from "../src/discordSeatAuditManager";

function buildJob(overrides?: Partial<ClaimedSeatAuditJob>): ClaimedSeatAuditJob {
  return {
    jobId: "job_1",
    claimToken: "claim_1",
    tenantKey: "t1",
    connectorId: "conn_01",
    guildId: "guild_1",
    attemptCount: 1,
    maxAttempts: 8,
    source: "test",
    runAfter: 1,
    createdAt: 1,
    seatLimit: 10,
    seatEnforcementEnabled: true,
    targetChannelIds: ["c1", "c2"],
    ...overrides,
  };
}

describe("discord seat audit manager", () => {
  it("returns early when enforcement is disabled", async () => {
    const client = {
      guilds: {
        fetch: async () => {
          throw new Error("should not fetch guild");
        },
      },
    } as unknown as Client;

    const manager = new DiscordSeatAuditManager(client);
    const result = await manager.executeJob(
      buildJob({
        seatEnforcementEnabled: false,
        seatLimit: 5,
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe("enforcement_disabled");
    expect(result.seatLimit).toBe(5);
    expect(result.seatsUsed).toBe(0);
  });

  it("counts unique non-bot members that can view any mapped channel", async () => {
    const channelVisibility = new Map<string, Set<string>>([
      ["c1", new Set(["u1", "u2"])],
      ["c2", new Set(["u2", "u3"])],
    ]);

    const guild = {
      channels: {
        fetch: async (channelId: string) => ({
          id: channelId,
          permissionsFor: (member: { id: string }) => ({
            has: () => channelVisibility.get(channelId)?.has(member.id) ?? false,
          }),
        }),
      },
      members: {
        list: async () =>
          new Collection([
            ["u1", { id: "u1", user: { bot: false } }],
            ["u2", { id: "u2", user: { bot: false } }],
            ["u3", { id: "u3", user: { bot: false } }],
            ["bot1", { id: "bot1", user: { bot: true } }],
          ]),
      },
    };

    const client = {
      guilds: {
        fetch: async () => guild,
      },
    } as unknown as Client;

    const manager = new DiscordSeatAuditManager(client);
    const result = await manager.executeJob(
      buildJob({
        seatLimit: 2,
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.seatsUsed).toBe(3);
    expect(result.seatLimit).toBe(2);
    expect(result.message).toBe("seat_limit_exceeded");
  });

  it("returns a clear member-list error when listing members is forbidden", async () => {
    const guild = {
      channels: {
        fetch: async () => ({
          id: "c1",
          permissionsFor: () => ({
            has: () => true,
          }),
        }),
      },
      members: {
        list: async () => {
          const error = Object.assign(new Error("Missing Access"), {
            status: 403,
            code: 50001,
          });
          throw error;
        },
      },
    };

    const client = {
      guilds: {
        fetch: async () => guild,
      },
    } as unknown as Client;

    const manager = new DiscordSeatAuditManager(client);
    const result = await manager.executeJob(buildJob({ targetChannelIds: ["c1"] }));

    expect(result.ok).toBe(false);
    expect(result.message).toContain("member_list_forbidden");
  });

  it("sends one over-limit notice per channel until the guild returns under limit", async () => {
    let visibleMembers = new Set(["u1", "u2", "u3"]);
    const sentEmbeds: unknown[] = [];

    const guild = {
      id: "guild_1",
      channels: {
        fetch: async () => ({
          id: "c1",
          permissionsFor: (member: { id: string }) => ({
            has: () => visibleMembers.has(member.id),
          }),
          send: async (payload: unknown) => {
            sentEmbeds.push(payload);
            return {};
          },
        }),
      },
      members: {
        list: async () =>
          new Collection(
            [...visibleMembers.values()].map((id) => [id, { id, user: { bot: false } }]),
          ),
      },
    };

    const client = {
      guilds: {
        fetch: async () => guild,
      },
    } as unknown as Client;

    const manager = new DiscordSeatAuditManager(client);

    const overLimitFirst = await manager.executeJob(
      buildJob({ seatLimit: 2, targetChannelIds: ["c1"] }),
    );
    expect(overLimitFirst.ok).toBe(true);
    expect(overLimitFirst.message).toBe("seat_limit_exceeded");
    expect(sentEmbeds.length).toBe(1);

    const overLimitSecond = await manager.executeJob(
      buildJob({ seatLimit: 2, targetChannelIds: ["c1"] }),
    );
    expect(overLimitSecond.ok).toBe(true);
    expect(overLimitSecond.message).toBe("seat_limit_exceeded");
    expect(sentEmbeds.length).toBe(1);

    visibleMembers = new Set(["u1"]);
    const underLimit = await manager.executeJob(
      buildJob({ seatLimit: 2, targetChannelIds: ["c1"] }),
    );
    expect(underLimit.ok).toBe(true);
    expect(underLimit.message).toBe("seat_limit_ok");

    visibleMembers = new Set(["u1", "u2", "u3"]);
    const overLimitAfterRecovery = await manager.executeJob(
      buildJob({ seatLimit: 2, targetChannelIds: ["c1"] }),
    );
    expect(overLimitAfterRecovery.ok).toBe(true);
    expect(overLimitAfterRecovery.message).toBe("seat_limit_exceeded");
    expect(sentEmbeds.length).toBe(2);
  });
});
