import {
  Client,
  DiscordAPIError,
  GatewayIntentBits,
  Guild,
  RESTJSONErrorCodes,
} from "discord.js";

import type { ClaimedRoleSyncJob } from "./convexRoleSyncClient";

export type RoleSyncExecutionResult = {
  ok: boolean;
  message: string;
};

export class DiscordRoleManager {
  private readonly client: Client;

  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });
  }

  get discordClient(): Client {
    return this.client;
  }

  async login(token: string): Promise<void> {
    await this.client.login(token);
  }

  async destroy(): Promise<void> {
    this.client.destroy();
  }

  async executeJob(job: ClaimedRoleSyncJob): Promise<RoleSyncExecutionResult> {
    const guild = await this.client.guilds.fetch(job.guildId);
    if (!guild) {
      return {
        ok: false,
        message: `guild_not_found:${job.guildId}`,
      };
    }

    if (job.action === "grant") {
      return await this.grantRole(guild, job.discordUserId, job.roleId, job.jobId);
    }
    return await this.revokeRole(guild, job.discordUserId, job.roleId, job.jobId);
  }

  private async grantRole(
    guild: Guild,
    discordUserId: string,
    roleId: string,
    jobId: string,
  ): Promise<RoleSyncExecutionResult> {
    const member = await guild.members.fetch(discordUserId).catch((error: unknown) => {
      const parsed = parseDiscordError(error);
      if (parsed.code === RESTJSONErrorCodes.UnknownMember) {
        return null;
      }
      throw error;
    });

    if (!member) {
      return {
        ok: false,
        message: `member_not_in_guild:${discordUserId}`,
      };
    }

    if (member.roles.cache.has(roleId)) {
      return {
        ok: true,
        message: "already_has_role",
      };
    }

    await member.roles.add(roleId, `role-sync grant job=${jobId}`);
    return {
      ok: true,
      message: "role_granted",
    };
  }

  private async revokeRole(
    guild: Guild,
    discordUserId: string,
    roleId: string,
    jobId: string,
  ): Promise<RoleSyncExecutionResult> {
    const member = await guild.members.fetch(discordUserId).catch((error: unknown) => {
      const parsed = parseDiscordError(error);
      if (parsed.code === RESTJSONErrorCodes.UnknownMember) {
        return null;
      }
      throw error;
    });

    if (!member) {
      return {
        ok: true,
        message: "member_not_in_guild",
      };
    }

    if (!member.roles.cache.has(roleId)) {
      return {
        ok: true,
        message: "role_already_absent",
      };
    }

    await member.roles.remove(roleId, `role-sync revoke job=${jobId}`);
    return {
      ok: true,
      message: "role_revoked",
    };
  }
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
