import {
  Channel,
  Client,
  DiscordAPIError,
  Guild,
  GuildMember,
  PermissionsBitField,
  RESTJSONErrorCodes,
} from "discord.js";

import type { ClaimedSeatAuditJob } from "./convexSeatAuditClient";

export type SeatAuditExecutionResult = {
  ok: boolean;
  message: string;
  seatsUsed?: number;
  seatLimit?: number;
  checkedAt?: number;
};

type PermissionChannel = Channel & {
  permissionsFor: (
    memberOrRole: GuildMember,
    checkAdmin?: boolean,
  ) => Readonly<PermissionsBitField> | null;
};

function supportsPermissionChecks(channel: Channel): channel is PermissionChannel {
  const maybe = channel as unknown as Partial<PermissionChannel>;
  return typeof maybe.permissionsFor === "function";
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

export class DiscordSeatAuditManager {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async executeJob(job: ClaimedSeatAuditJob): Promise<SeatAuditExecutionResult> {
    const checkedAt = Date.now();
    const seatLimit =
      typeof job.seatLimit === "number" && Number.isFinite(job.seatLimit) && job.seatLimit >= 0
        ? Math.trunc(job.seatLimit)
        : null;
    if (!job.seatEnforcementEnabled) {
      return {
        ok: true,
        message: "enforcement_disabled",
        seatsUsed: 0,
        seatLimit: seatLimit ?? 0,
        checkedAt,
      };
    }
    if (seatLimit === null) {
      return {
        ok: false,
        message: "seat_limit_missing",
      };
    }

    const guild = await this.fetchGuild(job.guildId);
    if (!guild) {
      return {
        ok: false,
        message: `terminal:guild_not_found:${job.guildId}`,
      };
    }

    const channels = await this.fetchPermissionChannels(guild, job.targetChannelIds);
    if (channels.length === 0) {
      return {
        ok: true,
        message: "no_target_channels",
        seatsUsed: 0,
        seatLimit,
        checkedAt,
      };
    }

    const members = await guild.members.fetch().catch((error: unknown) => {
      const parsed = parseDiscordError(error);
      throw new Error(`member_fetch_failed:${parsed.message}`);
    });

    let seatsUsed = 0;
    for (const member of members.values()) {
      if (member.user.bot) continue;
      let canViewAny = false;
      for (const channel of channels) {
        const permissions = channel.permissionsFor(member);
        if (!permissions) continue;
        if (permissions.has(PermissionsBitField.Flags.ViewChannel, true)) {
          canViewAny = true;
          break;
        }
      }
      if (canViewAny) seatsUsed += 1;
    }

    return {
      ok: true,
      message: seatsUsed > seatLimit ? "seat_limit_exceeded" : "seat_limit_ok",
      seatsUsed,
      seatLimit,
      checkedAt,
    };
  }

  private async fetchGuild(guildId: string): Promise<Guild | null> {
    return await this.client.guilds.fetch(guildId).catch((error: unknown) => {
      const parsed = parseDiscordError(error);
      if (parsed.code === RESTJSONErrorCodes.UnknownGuild) {
        return null;
      }
      throw error;
    });
  }

  private async fetchPermissionChannels(
    guild: Guild,
    targetChannelIds: string[],
  ): Promise<PermissionChannel[]> {
    const channels: PermissionChannel[] = [];
    for (const channelId of targetChannelIds) {
      const normalized = channelId.trim();
      if (!normalized) continue;
      const channel = await guild.channels.fetch(normalized).catch((error: unknown) => {
        const parsed = parseDiscordError(error);
        if (parsed.code === RESTJSONErrorCodes.UnknownChannel) {
          return null;
        }
        throw error;
      });
      if (!channel) continue;
      if (!supportsPermissionChecks(channel)) continue;
      channels.push(channel);
    }
    return channels;
  }
}
