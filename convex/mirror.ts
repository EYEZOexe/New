import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getMirrorBotTokenFromEnv, nextMirrorRetryAt } from "./mirrorQueue";

function assertBotTokenOrThrow(token: string) {
  const expected = getMirrorBotTokenFromEnv();
  if (!expected) {
    throw new Error("mirror_bot_token_not_configured");
  }
  if (token !== expected) {
    throw new Error("unauthorized");
  }
}

export const claimPendingSignalMirrorJobs = mutation({
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
      .query("signalMirrorJobs")
      .withIndex("by_status_runAfter", (q) =>
        q.eq("status", "pending").lte("runAfter", now),
      )
      .order("asc")
      .take(limit);

    const claimed: Array<{
      jobId: string;
      claimToken: string;
      tenantKey: string;
      connectorId: string;
      sourceMessageId: string;
      sourceChannelId: string;
      sourceGuildId: string;
      targetChannelId: string;
      eventType: "create" | "update" | "delete";
      content: string;
      attachments: Array<{
        url: string;
        name?: string;
        contentType?: string;
        size?: number;
      }>;
      sourceCreatedAt: number;
      sourceEditedAt: number | null;
      sourceDeletedAt: number | null;
      attemptCount: number;
      maxAttempts: number;
      runAfter: number;
      createdAt: number;
      existingMirroredMessageId: string | null;
      existingMirroredGuildId: string | null;
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

      const existingMirror = await ctx.db
        .query("mirroredSignals")
        .withIndex("by_source_target", (q) =>
          q
            .eq("tenantKey", job.tenantKey)
            .eq("connectorId", job.connectorId)
            .eq("sourceMessageId", job.sourceMessageId)
            .eq("targetChannelId", job.targetChannelId),
        )
        .first();

      claimed.push({
        jobId: job._id,
        claimToken,
        tenantKey: job.tenantKey,
        connectorId: job.connectorId,
        sourceMessageId: job.sourceMessageId,
        sourceChannelId: job.sourceChannelId,
        sourceGuildId: job.sourceGuildId,
        targetChannelId: job.targetChannelId,
        eventType: job.eventType,
        content: job.content,
        attachments: job.attachments ?? [],
        sourceCreatedAt: job.sourceCreatedAt,
        sourceEditedAt: job.sourceEditedAt ?? null,
        sourceDeletedAt: job.sourceDeletedAt ?? null,
        attemptCount: nextAttemptCount,
        maxAttempts: job.maxAttempts,
        runAfter: job.runAfter,
        createdAt: job.createdAt,
        existingMirroredMessageId: existingMirror?.mirroredMessageId ?? null,
        existingMirroredGuildId: existingMirror?.mirroredGuildId ?? null,
      });
    }

    if (claimed.length > 0) {
      console.info(
        `[mirror] claimed jobs=${claimed.length} worker=${workerId ?? "unknown"} limit=${limit}`,
      );
    }

    return claimed;
  },
});

export const completeSignalMirrorJob = mutation({
  args: {
    botToken: v.string(),
    jobId: v.id("signalMirrorJobs"),
    claimToken: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
    mirroredMessageId: v.optional(v.string()),
    mirroredGuildId: v.optional(v.string()),
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

      const existingMirror = await ctx.db
        .query("mirroredSignals")
        .withIndex("by_source_target", (q) =>
          q
            .eq("tenantKey", job.tenantKey)
            .eq("connectorId", job.connectorId)
            .eq("sourceMessageId", job.sourceMessageId)
            .eq("targetChannelId", job.targetChannelId),
        )
        .first();

      const mirroredMessageId = args.mirroredMessageId?.trim() ?? "";
      const mirroredGuildId = args.mirroredGuildId?.trim() ?? "";
      if (existingMirror) {
        await ctx.db.patch(existingMirror._id, {
          mirroredMessageId: mirroredMessageId || existingMirror.mirroredMessageId,
          mirroredGuildId: mirroredGuildId || existingMirror.mirroredGuildId,
          lastMirroredAt: now,
          deletedAt: job.eventType === "delete" ? now : undefined,
        });
      } else if (mirroredMessageId) {
        await ctx.db.insert("mirroredSignals", {
          tenantKey: job.tenantKey,
          connectorId: job.connectorId,
          sourceMessageId: job.sourceMessageId,
          targetChannelId: job.targetChannelId,
          mirroredMessageId,
          mirroredGuildId: mirroredGuildId || undefined,
          lastMirroredAt: now,
          deletedAt: job.eventType === "delete" ? now : undefined,
        });
      }

      console.info(
        `[mirror] completed job=${job._id} event=${job.eventType} source_message=${job.sourceMessageId} target_channel=${job.targetChannelId}`,
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
        `[mirror] failed job=${job._id} event=${job.eventType} attempts=${attemptCount}/${job.maxAttempts} error=${error}`,
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
      runAfter: nextMirrorRetryAt(now, attemptCount),
      claimToken: undefined,
      claimWorkerId: undefined,
      claimedAt: undefined,
      lastError: error,
    });

    console.warn(
      `[mirror] requeued job=${job._id} event=${job.eventType} attempts=${attemptCount}/${job.maxAttempts} error=${error}`,
    );
    return {
      ok: true,
      ignored: false,
      status: "pending" as const,
    };
  },
});

export const getSignalMirrorRuntimeStatus = query({
  args: {},
  handler: async () => {
    const dedicatedMirrorBotToken = process.env.MIRROR_BOT_TOKEN?.trim() ?? "";
    const roleSyncBotToken = process.env.ROLE_SYNC_BOT_TOKEN?.trim() ?? "";
    return {
      hasMirrorBotToken: Boolean(dedicatedMirrorBotToken || roleSyncBotToken),
      usesDedicatedMirrorToken: Boolean(dedicatedMirrorBotToken),
      sharedRoleSyncTokenFallback: Boolean(!dedicatedMirrorBotToken && roleSyncBotToken),
    };
  },
});

export const getSignalMirrorQueueStats = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("signalMirrorJobs")
      .withIndex("by_tenant_connector", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();

    const now = Date.now();
    let pending = 0;
    let pendingReady = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      if (job.status === "pending") {
        pending += 1;
        if (job.runAfter <= now) pendingReady += 1;
      } else if (job.status === "processing") {
        processing += 1;
      } else if (job.status === "completed") {
        completed += 1;
      } else if (job.status === "failed") {
        failed += 1;
      }
    }

    return {
      pending,
      pendingReady,
      processing,
      completed,
      failed,
      total: jobs.length,
      updatedAt: now,
    };
  },
});

export const listSignalMirrorJobs = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
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
    const rows = await ctx.db
      .query("signalMirrorJobs")
      .withIndex("by_tenant_connector", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .order("desc")
      .take(limit * 4);

    return rows
      .filter((row) => (args.status ? row.status === args.status : true))
      .slice(0, limit)
      .map((row) => ({
        jobId: row._id,
        sourceMessageId: row.sourceMessageId,
        sourceChannelId: row.sourceChannelId,
        targetChannelId: row.targetChannelId,
        eventType: row.eventType,
        status: row.status,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        runAfter: row.runAfter,
        lastError: row.lastError ?? null,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      }));
  },
});
