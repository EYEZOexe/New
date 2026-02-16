import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { listEnabledTierRoleMappings } from "./discordRoleConfig";

export const DEFAULT_ROLE_SYNC_MAX_ATTEMPTS = 8;

export type RoleSyncAction = "grant" | "revoke";
export type SubscriptionStatus = "active" | "inactive" | "canceled" | "past_due";

type RoleSyncTarget = {
  guildId: string;
  roleId: string;
};

function getLegacyRoleSyncConfigFromEnv(): RoleSyncTarget | null {
  const guildId = process.env.DISCORD_CUSTOMER_GUILD_ID?.trim() ?? "";
  const roleId = process.env.DISCORD_CUSTOMER_ROLE_ID?.trim() ?? "";
  if (!guildId || !roleId) return null;
  return { guildId, roleId };
}

export function getRoleSyncBotTokenFromEnv(): string | null {
  const token = process.env.ROLE_SYNC_BOT_TOKEN?.trim() ?? "";
  return token || null;
}

function uniqueRoleTargets(targets: RoleSyncTarget[]): RoleSyncTarget[] {
  const seen = new Set<string>();
  const deduped: RoleSyncTarget[] = [];
  for (const target of targets) {
    const key = `${target.guildId}:${target.roleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(target);
  }
  return deduped;
}

async function resolveRoleTargetsForSubscription(
  ctx: MutationCtx,
  args: {
    status: SubscriptionStatus;
    productId: string | null;
  },
): Promise<{
  desiredRoles: RoleSyncTarget[];
  allManagedRoles: RoleSyncTarget[];
  mappedTier: "basic" | "advanced" | "pro" | null;
  mappingSource: "tier_config" | "legacy_env" | "none";
}> {
  const tierMappings = await listEnabledTierRoleMappings(ctx);
  if (tierMappings.length > 0) {
    const allManagedRoles = uniqueRoleTargets(
      tierMappings.map((row) => ({
        guildId: row.guildId,
        roleId: row.roleId,
      })),
    );

    if (args.status !== "active") {
      return {
        desiredRoles: [],
        allManagedRoles,
        mappedTier: null,
        mappingSource: "tier_config",
      };
    }

    const productId = args.productId?.trim() ?? "";
    if (!productId) {
      return {
        desiredRoles: [],
        allManagedRoles,
        mappedTier: null,
        mappingSource: "tier_config",
      };
    }

    const mapped = tierMappings.find((row) => row.productId === productId);
    if (!mapped) {
      return {
        desiredRoles: [],
        allManagedRoles,
        mappedTier: null,
        mappingSource: "tier_config",
      };
    }

    return {
      desiredRoles: [{ guildId: mapped.guildId, roleId: mapped.roleId }],
      allManagedRoles,
      mappedTier: mapped.tier,
      mappingSource: "tier_config",
    };
  }

  const legacyConfig = getLegacyRoleSyncConfigFromEnv();
  if (legacyConfig) {
    return {
      desiredRoles: args.status === "active" ? [legacyConfig] : [],
      allManagedRoles: [legacyConfig],
      mappedTier: null,
      mappingSource: "legacy_env",
    };
  }

  return {
    desiredRoles: [],
    allManagedRoles: [],
    mappedTier: null,
    mappingSource: "none",
  };
}

async function enqueueRoleSyncJobForTarget(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    discordUserId: string;
    guildId: string;
    roleId: string;
    action: RoleSyncAction;
    source: string;
    now: number;
  },
): Promise<
  | {
      enqueued: true;
      deduped: boolean;
      jobId: Id<"roleSyncJobs">;
      guildId: string;
      roleId: string;
    }
  | { enqueued: false; reason: "not_configured" | "invalid_discord_user_id" }
> {
  const discordUserId = args.discordUserId.trim();
  if (!discordUserId) {
    return { enqueued: false, reason: "invalid_discord_user_id" };
  }

  const guildId = args.guildId.trim();
  const roleId = args.roleId.trim();
  if (!guildId || !roleId) {
    return { enqueued: false, reason: "not_configured" };
  }

  const statuses: Array<"pending" | "processing"> = ["pending", "processing"];
  for (const status of statuses) {
    const existing = await ctx.db
      .query("roleSyncJobs")
      .withIndex("by_dedupe", (q) =>
        q
          .eq("userId", args.userId)
          .eq("discordUserId", discordUserId)
          .eq("guildId", guildId)
          .eq("roleId", roleId)
          .eq("action", args.action)
          .eq("status", status),
      )
      .first();
    if (existing) {
      return {
        enqueued: true,
        deduped: true,
        jobId: existing._id,
        guildId,
        roleId,
      };
    }
  }

  const insertedId = await ctx.db.insert("roleSyncJobs", {
    userId: args.userId,
    discordUserId,
    guildId,
    roleId,
    action: args.action,
    status: "pending",
    source: args.source,
    attemptCount: 0,
    maxAttempts: DEFAULT_ROLE_SYNC_MAX_ATTEMPTS,
    runAfter: args.now,
    createdAt: args.now,
    updatedAt: args.now,
  });

  return {
    enqueued: true,
    deduped: false,
    jobId: insertedId,
    guildId,
    roleId,
  };
}

export async function enqueueRoleSyncJobsForSubscription(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    discordUserId: string;
    subscriptionStatus: SubscriptionStatus;
    productId: string | null;
    source: string;
    now: number;
  },
): Promise<{
  mappingSource: "tier_config" | "legacy_env" | "none";
  mappedTier: "basic" | "advanced" | "pro" | null;
  granted: number;
  revoked: number;
  deduped: number;
  skipped: number;
}> {
  const resolution = await resolveRoleTargetsForSubscription(ctx, {
    status: args.subscriptionStatus,
    productId: args.productId,
  });

  if (resolution.allManagedRoles.length === 0) {
    return {
      mappingSource: resolution.mappingSource,
      mappedTier: resolution.mappedTier,
      granted: 0,
      revoked: 0,
      deduped: 0,
      skipped: 1,
    };
  }

  const desiredKeys = new Set(
    resolution.desiredRoles.map((row) => `${row.guildId}:${row.roleId}`),
  );
  const grantTargets = resolution.desiredRoles;
  const revokeTargets = resolution.allManagedRoles.filter(
    (row) => !desiredKeys.has(`${row.guildId}:${row.roleId}`),
  );

  let granted = 0;
  let revoked = 0;
  let deduped = 0;
  let skipped = 0;

  for (const target of grantTargets) {
    const result = await enqueueRoleSyncJobForTarget(ctx, {
      userId: args.userId,
      discordUserId: args.discordUserId,
      guildId: target.guildId,
      roleId: target.roleId,
      action: "grant",
      source: args.source,
      now: args.now,
    });
    if (!result.enqueued) {
      skipped += 1;
      continue;
    }
    if (result.deduped) deduped += 1;
    else granted += 1;
  }

  for (const target of revokeTargets) {
    const result = await enqueueRoleSyncJobForTarget(ctx, {
      userId: args.userId,
      discordUserId: args.discordUserId,
      guildId: target.guildId,
      roleId: target.roleId,
      action: "revoke",
      source: args.source,
      now: args.now,
    });
    if (!result.enqueued) {
      skipped += 1;
      continue;
    }
    if (result.deduped) deduped += 1;
    else revoked += 1;
  }

  return {
    mappingSource: resolution.mappingSource,
    mappedTier: resolution.mappedTier,
    granted,
    revoked,
    deduped,
    skipped,
  };
}

export function nextRoleSyncRetryAt(now: number, attemptCount: number): number {
  const baseMs = 5000;
  const exponent = Math.max(0, attemptCount - 1);
  const delay = Math.min(15 * 60 * 1000, baseMs * 2 ** exponent);
  return now + delay;
}
