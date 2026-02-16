import { v } from "convex/values";

import { internalQuery, mutation } from "./_generated/server";
import {
  getRoleSyncBotTokenFromEnv,
  nextRoleSyncRetryAt,
} from "./roleSyncQueue";

function assertBotTokenOrThrow(token: string) {
  const expected = getRoleSyncBotTokenFromEnv();
  if (!expected) {
    throw new Error("role_sync_bot_token_not_configured");
  }
  if (token !== expected) {
    throw new Error("unauthorized");
  }
}

export const claimPendingRoleSyncJobs = mutation({
  args: {
    botToken: v.string(),
    limit: v.optional(v.number()),
    workerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertBotTokenOrThrow(args.botToken);

    const now = Date.now();
    const limit = Math.max(1, Math.min(20, args.limit ?? 5));
    const workerId = args.workerId?.trim() || undefined;

    const pending = await ctx.db
      .query("roleSyncJobs")
      .withIndex("by_status_runAfter", (q) =>
        q.eq("status", "pending").lte("runAfter", now),
      )
      .order("asc")
      .take(limit);

    const claimed: Array<{
      jobId: string;
      claimToken: string;
      userId: string;
      discordUserId: string;
      guildId: string;
      roleId: string;
      action: "grant" | "revoke";
      attemptCount: number;
      maxAttempts: number;
      source: string | null;
      runAfter: number;
      createdAt: number;
    }> = [];

    for (const job of pending) {
      const claimToken = crypto.randomUUID();
      const nextAttemptCount = (job.attemptCount ?? 0) + 1;

      await ctx.db.patch(job._id, {
        status: "processing",
        claimToken,
        claimWorkerId: workerId,
        claimedAt: now,
        lastAttemptAt: now,
        attemptCount: nextAttemptCount,
        updatedAt: now,
        lastError: undefined,
      });

      claimed.push({
        jobId: job._id,
        claimToken,
        userId: job.userId,
        discordUserId: job.discordUserId,
        guildId: job.guildId,
        roleId: job.roleId,
        action: job.action,
        attemptCount: nextAttemptCount,
        maxAttempts: job.maxAttempts,
        source: job.source ?? null,
        runAfter: job.runAfter,
        createdAt: job.createdAt,
      });
    }

    if (claimed.length > 0) {
      console.info(
        `[role-sync] claimed jobs=${claimed.length} worker=${workerId ?? "unknown"} limit=${limit}`,
      );
    }

    return claimed;
  },
});

export const completeRoleSyncJob = mutation({
  args: {
    botToken: v.string(),
    jobId: v.id("roleSyncJobs"),
    claimToken: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertBotTokenOrThrow(args.botToken);

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return { ok: false, ignored: true, reason: "job_not_found" as const };
    }

    if (job.status !== "processing") {
      return {
        ok: false,
        ignored: true,
        reason: "job_not_processing" as const,
      };
    }

    if (!job.claimToken || job.claimToken !== args.claimToken) {
      return {
        ok: false,
        ignored: true,
        reason: "claim_token_mismatch" as const,
      };
    }

    const now = Date.now();
    if (args.success) {
      await ctx.db.patch(job._id, {
        status: "completed",
        updatedAt: now,
        claimToken: undefined,
        claimWorkerId: undefined,
        claimedAt: undefined,
        lastError: undefined,
      });
      console.info(
        `[role-sync] completed job=${job._id} action=${job.action} discord_user=${job.discordUserId}`,
      );
      return {
        ok: true,
        ignored: false,
        status: "completed" as const,
      };
    }

    const error = args.error?.trim() || "unknown_error";
    const attemptCount = job.attemptCount ?? 0;
    if (attemptCount >= job.maxAttempts) {
      await ctx.db.patch(job._id, {
        status: "failed",
        updatedAt: now,
        claimToken: undefined,
        claimWorkerId: undefined,
        claimedAt: undefined,
        lastError: error,
      });
      console.error(
        `[role-sync] failed job=${job._id} action=${job.action} attempts=${attemptCount}/${job.maxAttempts} error=${error}`,
      );
      return {
        ok: true,
        ignored: false,
        status: "failed" as const,
      };
    }

    await ctx.db.patch(job._id, {
      status: "pending",
      updatedAt: now,
      runAfter: nextRoleSyncRetryAt(now, attemptCount),
      claimToken: undefined,
      claimWorkerId: undefined,
      claimedAt: undefined,
      lastError: error,
    });

    console.warn(
      `[role-sync] requeued job=${job._id} action=${job.action} attempts=${attemptCount}/${job.maxAttempts} error=${error}`,
    );
    return {
      ok: true,
      ignored: false,
      status: "pending" as const,
    };
  },
});

export const listRoleSyncJobs = internalQuery({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, args.limit ?? 50));
    if (args.status) {
      const rows = await ctx.db
        .query("roleSyncJobs")
        .withIndex("by_status_runAfter", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
      return rows.map((row) => ({
        jobId: row._id,
        userId: row.userId,
        discordUserId: row.discordUserId,
        guildId: row.guildId,
        roleId: row.roleId,
        action: row.action,
        status: row.status,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        runAfter: row.runAfter,
        source: row.source ?? null,
        lastError: row.lastError ?? null,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      }));
    }

    const rows = await ctx.db.query("roleSyncJobs").order("desc").take(limit);
    return rows.map((row) => ({
      jobId: row._id,
      userId: row.userId,
      discordUserId: row.discordUserId,
      guildId: row.guildId,
      roleId: row.roleId,
      action: row.action,
      status: row.status,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      runAfter: row.runAfter,
      source: row.source ?? null,
      lastError: row.lastError ?? null,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    }));
  },
});
