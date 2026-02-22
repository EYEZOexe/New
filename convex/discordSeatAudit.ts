import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

const DEFAULT_SEAT_AUDIT_MAX_ATTEMPTS = 8;
const DEFAULT_SEAT_AUDIT_RECHECK_MS = 60_000;
const OVER_LIMIT_RECHECK_MS = 30_000;
const FRESH_MS = 90_000;
const STALE_MS = 5 * 60_000;

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field}_required`);
  }
  return normalized;
}

function normalizeNonNegativeInt(value: number, field: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${field}_invalid`);
  }
  return value;
}

function nextSeatAuditRetryAt(now: number, attemptCount: number): number {
  const baseMs = 5_000;
  const exponent = Math.max(0, attemptCount - 1);
  const delay = Math.min(15 * 60 * 1000, baseMs * 2 ** exponent);
  return now + delay;
}

function computeSnapshotStatus(now: number, checkedAt: number): "fresh" | "stale" | "expired" {
  const ageMs = Math.max(0, now - checkedAt);
  if (ageMs <= FRESH_MS) return "fresh";
  if (ageMs <= STALE_MS) return "stale";
  return "expired";
}

function getAllowedWorkerTokens(): Set<string> {
  const roleToken = process.env.ROLE_SYNC_BOT_TOKEN?.trim() ?? "";
  const mirrorToken = process.env.MIRROR_BOT_TOKEN?.trim() ?? "";
  return new Set([roleToken, mirrorToken].filter((token) => token.length > 0));
}

function assertSeatAuditBotTokenOrThrow(token: string) {
  const allowed = getAllowedWorkerTokens();
  if (allowed.size === 0) {
    throw new Error("seat_audit_bot_token_not_configured");
  }
  if (!allowed.has(token)) {
    throw new Error("unauthorized");
  }
}

async function getSnapshotByKey(
  ctx: QueryCtx | MutationCtx,
  args: { tenantKey: string; connectorId: string; guildId: string },
) {
  return await ctx.db
    .query("discordServerSeatSnapshots")
    .withIndex("by_tenant_connector_guild", (q) =>
      q
        .eq("tenantKey", args.tenantKey)
        .eq("connectorId", args.connectorId)
        .eq("guildId", args.guildId),
    )
    .first();
}

async function getServerConfigByKey(
  ctx: QueryCtx | MutationCtx,
  args: { tenantKey: string; connectorId: string; guildId: string },
) {
  return await ctx.db
    .query("discordServerConfigs")
    .withIndex("by_tenant_connector_guild", (q) =>
      q
        .eq("tenantKey", args.tenantKey)
        .eq("connectorId", args.connectorId)
        .eq("guildId", args.guildId),
    )
    .first();
}

async function listMappedTargetChannelsForGuild(
  ctx: QueryCtx | MutationCtx,
  args: { tenantKey: string; connectorId: string; guildId: string },
): Promise<string[]> {
  const [mappings, sources] = await Promise.all([
    ctx.db
      .query("connectorMappings")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect(),
    ctx.db
      .query("connectorSources")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect(),
  ]);
  const sourceGuildByChannelId = new Map(
    sources.map((source) => [source.channelId.trim(), source.guildId.trim()]),
  );

  const uniqueTargetChannelIds = new Set<string>();
  for (const mapping of mappings) {
    const targetChannelId = mapping.targetChannelId.trim();
    if (!targetChannelId) continue;
    uniqueTargetChannelIds.add(targetChannelId);
  }

  const botChannelRows = await Promise.all(
    Array.from(uniqueTargetChannelIds.values()).map((channelId) =>
      ctx.db
        .query("discordBotChannels")
        .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
        .first(),
    ),
  );
  const botGuildByChannelId = new Map(
    botChannelRows
      .filter((channel): channel is NonNullable<typeof channel> => channel !== null)
      .map((channel) => [channel.channelId.trim(), channel.guildId.trim()]),
  );

  const unique = new Set<string>();
  for (const mapping of mappings) {
    const targetChannelId = mapping.targetChannelId.trim();
    if (!targetChannelId) continue;
    const guildId =
      botGuildByChannelId.get(targetChannelId) ?? sourceGuildByChannelId.get(targetChannelId);
    if (guildId !== args.guildId) continue;
    unique.add(targetChannelId);
  }
  return [...unique];
}

export async function enqueueSeatAuditJobForServer(
  ctx: MutationCtx,
  args: {
    tenantKey: string;
    connectorId: string;
    guildId: string;
    source: string;
    now: number;
    runAfter?: number;
  },
): Promise<{ enqueued: boolean; deduped: boolean; jobId: string | null }> {
  const tenantKey = normalizeRequired(args.tenantKey, "tenant_key");
  const connectorId = normalizeRequired(args.connectorId, "connector_id");
  const guildId = normalizeRequired(args.guildId, "guild_id");
  const statuses: Array<"pending" | "processing"> = ["pending", "processing"];
  for (const status of statuses) {
    const existing = await ctx.db
      .query("discordSeatAuditJobs")
      .withIndex("by_dedupe", (q) =>
        q
          .eq("tenantKey", tenantKey)
          .eq("connectorId", connectorId)
          .eq("guildId", guildId)
          .eq("status", status),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        source: args.source,
        ...(status === "pending"
          ? {
              runAfter: Math.min(
                existing.runAfter,
                typeof args.runAfter === "number" ? args.runAfter : args.now,
              ),
            }
          : {}),
        updatedAt: args.now,
      });
      return {
        enqueued: true,
        deduped: true,
        jobId: existing._id,
      };
    }
  }

  const inserted = await ctx.db.insert("discordSeatAuditJobs", {
    tenantKey,
    connectorId,
    guildId,
    status: "pending",
    source: args.source,
    attemptCount: 0,
    maxAttempts: DEFAULT_SEAT_AUDIT_MAX_ATTEMPTS,
    runAfter: typeof args.runAfter === "number" ? args.runAfter : args.now,
    createdAt: args.now,
    updatedAt: args.now,
  });
  return { enqueued: true, deduped: false, jobId: inserted };
}

export const requestSeatAuditRefresh = mutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const result = await enqueueSeatAuditJobForServer(ctx, {
      tenantKey: args.tenantKey,
      connectorId: args.connectorId,
      guildId: args.guildId,
      source: args.source?.trim() || "admin_manual_refresh",
      now,
    });
    console.info(
      `[seat-audit] refresh requested tenant=${args.tenantKey} connector=${args.connectorId} guild=${args.guildId} deduped=${result.deduped}`,
    );
    return { ok: true as const, deduped: result.deduped, jobId: result.jobId };
  },
});

export const claimPendingSeatAuditJobs = mutation({
  args: {
    botToken: v.string(),
    limit: v.optional(v.number()),
    workerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSeatAuditBotTokenOrThrow(args.botToken);
    const now = Date.now();
    const limit = Math.max(1, Math.min(20, args.limit ?? 5));
    const workerId = args.workerId?.trim() || undefined;
    const pending = await ctx.db
      .query("discordSeatAuditJobs")
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
      guildId: string;
      attemptCount: number;
      maxAttempts: number;
      source: string | null;
      runAfter: number;
      createdAt: number;
      seatLimit: number | null;
      seatEnforcementEnabled: boolean;
      targetChannelIds: string[];
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

      const [serverConfig, targetChannelIds] = await Promise.all([
        getServerConfigByKey(ctx, {
          tenantKey: job.tenantKey,
          connectorId: job.connectorId,
          guildId: job.guildId,
        }),
        listMappedTargetChannelsForGuild(ctx, {
          tenantKey: job.tenantKey,
          connectorId: job.connectorId,
          guildId: job.guildId,
        }),
      ]);
      if (serverConfig?.seatEnforcementEnabled === true && targetChannelIds.length === 0) {
        console.warn(
          `[seat-audit] claimed job has no target channels tenant=${job.tenantKey} connector=${job.connectorId} guild=${job.guildId}`,
        );
      }

      claimed.push({
        jobId: job._id,
        claimToken,
        tenantKey: job.tenantKey,
        connectorId: job.connectorId,
        guildId: job.guildId,
        attemptCount: nextAttemptCount,
        maxAttempts: job.maxAttempts,
        source: job.source ?? null,
        runAfter: job.runAfter,
        createdAt: job.createdAt,
        seatLimit: serverConfig?.seatLimit ?? null,
        seatEnforcementEnabled: serverConfig?.seatEnforcementEnabled === true,
        targetChannelIds,
      });
    }

    if (claimed.length > 0) {
      console.info(
        `[seat-audit] claimed jobs=${claimed.length} worker=${workerId ?? "unknown"} limit=${limit}`,
      );
    }
    return claimed;
  },
});

export const completeSeatAuditJob = mutation({
  args: {
    botToken: v.string(),
    jobId: v.id("discordSeatAuditJobs"),
    claimToken: v.string(),
    success: v.boolean(),
    seatsUsed: v.optional(v.number()),
    seatLimit: v.optional(v.number()),
    checkedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSeatAuditBotTokenOrThrow(args.botToken);
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return { ok: false as const, ignored: true as const, reason: "job_not_found" as const };
    }
    if (job.status !== "processing") {
      return {
        ok: false as const,
        ignored: true as const,
        reason: "job_not_processing" as const,
      };
    }
    if (!job.claimToken || job.claimToken !== args.claimToken) {
      return {
        ok: false as const,
        ignored: true as const,
        reason: "claim_token_mismatch" as const,
      };
    }

    const now = Date.now();
    if (args.success) {
      const checkedAt =
        typeof args.checkedAt === "number" && Number.isFinite(args.checkedAt)
          ? args.checkedAt
          : now;
      const seatsUsed = normalizeNonNegativeInt(args.seatsUsed ?? 0, "seats_used");
      const config = await getServerConfigByKey(ctx, {
        tenantKey: job.tenantKey,
        connectorId: job.connectorId,
        guildId: job.guildId,
      });
      const seatLimit = normalizeNonNegativeInt(
        args.seatLimit ?? config?.seatLimit ?? 0,
        "seat_limit",
      );
      const isOverLimit = seatsUsed > seatLimit;
      const status = computeSnapshotStatus(now, checkedAt);
      const nextCheckAfter =
        checkedAt + (isOverLimit ? OVER_LIMIT_RECHECK_MS : DEFAULT_SEAT_AUDIT_RECHECK_MS);

      const existingSnapshot = await getSnapshotByKey(ctx, {
        tenantKey: job.tenantKey,
        connectorId: job.connectorId,
        guildId: job.guildId,
      });
      if (existingSnapshot) {
        await ctx.db.patch(existingSnapshot._id, {
          seatsUsed,
          seatLimit,
          isOverLimit,
          status,
          checkedAt,
          nextCheckAfter,
          lastError: undefined,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("discordServerSeatSnapshots", {
          tenantKey: job.tenantKey,
          connectorId: job.connectorId,
          guildId: job.guildId,
          seatsUsed,
          seatLimit,
          isOverLimit,
          status,
          checkedAt,
          nextCheckAfter,
          updatedAt: now,
        });
      }

      await ctx.db.patch(job._id, {
        status: "completed",
        updatedAt: now,
        claimToken: undefined,
        claimWorkerId: undefined,
        claimedAt: undefined,
        lastError: undefined,
      });

      await enqueueSeatAuditJobForServer(ctx, {
        tenantKey: job.tenantKey,
        connectorId: job.connectorId,
        guildId: job.guildId,
        source: "auto_snapshot_recheck",
        now,
        runAfter: nextCheckAfter,
      });

      console.info(
        `[seat-audit] completed job=${job._id} tenant=${job.tenantKey} connector=${job.connectorId} guild=${job.guildId} seats_used=${seatsUsed} seat_limit=${seatLimit} over_limit=${isOverLimit}`,
      );
      return {
        ok: true as const,
        ignored: false as const,
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
      const snapshot = await getSnapshotByKey(ctx, {
        tenantKey: job.tenantKey,
        connectorId: job.connectorId,
        guildId: job.guildId,
      });
      if (snapshot) {
        await ctx.db.patch(snapshot._id, {
          status: computeSnapshotStatus(now + STALE_MS + 1, snapshot.checkedAt),
          lastError: error,
          updatedAt: now,
        });
      }
      console.error(
        `[seat-audit] failed job=${job._id} tenant=${job.tenantKey} connector=${job.connectorId} guild=${job.guildId} attempts=${attemptCount}/${job.maxAttempts} error=${error}`,
      );
      return {
        ok: true as const,
        ignored: false as const,
        status: "failed" as const,
      };
    }

    await ctx.db.patch(job._id, {
      status: "pending",
      updatedAt: now,
      runAfter: nextSeatAuditRetryAt(now, attemptCount),
      claimToken: undefined,
      claimWorkerId: undefined,
      claimedAt: undefined,
      lastError: error,
    });
    console.warn(
      `[seat-audit] requeued job=${job._id} tenant=${job.tenantKey} connector=${job.connectorId} guild=${job.guildId} attempts=${attemptCount}/${job.maxAttempts} error=${error}`,
    );
    return {
      ok: true as const,
      ignored: false as const,
      status: "pending" as const,
    };
  },
});

export const getServerSeatSnapshot = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantKey = normalizeRequired(args.tenantKey, "tenant_key");
    const connectorId = normalizeRequired(args.connectorId, "connector_id");
    const guildId = normalizeRequired(args.guildId, "guild_id");
    const snapshot = await getSnapshotByKey(ctx, {
      tenantKey,
      connectorId,
      guildId,
    });
    if (!snapshot) return null;
    const now = Date.now();
    return {
      tenantKey: snapshot.tenantKey,
      connectorId: snapshot.connectorId,
      guildId: snapshot.guildId,
      seatsUsed: snapshot.seatsUsed,
      seatLimit: snapshot.seatLimit,
      isOverLimit: snapshot.isOverLimit,
      status: computeSnapshotStatus(now, snapshot.checkedAt),
      checkedAt: snapshot.checkedAt,
      nextCheckAfter: snapshot.nextCheckAfter,
      lastError: snapshot.lastError ?? null,
      updatedAt: snapshot.updatedAt,
    };
  },
});

export const listSeatSnapshotsByConnector = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("discordServerSeatSnapshots")
      .withIndex("by_tenant_connector", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();
    const now = Date.now();
    rows.sort((a, b) => a.guildId.localeCompare(b.guildId));
    return rows.map((row) => ({
      tenantKey: row.tenantKey,
      connectorId: row.connectorId,
      guildId: row.guildId,
      seatsUsed: row.seatsUsed,
      seatLimit: row.seatLimit,
      isOverLimit: row.isOverLimit,
      status: computeSnapshotStatus(now, row.checkedAt),
      checkedAt: row.checkedAt,
      nextCheckAfter: row.nextCheckAfter,
      lastError: row.lastError ?? null,
      updatedAt: row.updatedAt,
    }));
  },
});

export const refreshSnapshotStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("discordServerSeatSnapshots").collect();
    const now = Date.now();
    let updated = 0;
    for (const row of rows) {
      const status = computeSnapshotStatus(now, row.checkedAt);
      if (status === row.status) continue;
      await ctx.db.patch(row._id, { status, updatedAt: now });
      updated += 1;
    }
    return { updated };
  },
});

export const enqueueDueSeatAuditJobs = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.max(1, Math.min(500, args.limit ?? 100));
    let enqueued = 0;
    let deduped = 0;

    const snapshots = await ctx.db.query("discordServerSeatSnapshots").collect();
    const dueSnapshots = snapshots
      .filter((snapshot) => snapshot.nextCheckAfter <= now)
      .sort((a, b) => a.nextCheckAfter - b.nextCheckAfter)
      .slice(0, limit);

    for (const snapshot of dueSnapshots) {
      const result = await enqueueSeatAuditJobForServer(ctx, {
        tenantKey: snapshot.tenantKey,
        connectorId: snapshot.connectorId,
        guildId: snapshot.guildId,
        source: "scheduled_snapshot_recheck",
        now,
      });
      if (!result.enqueued) continue;
      if (result.deduped) deduped += 1;
      else enqueued += 1;
    }

    if (enqueued + deduped < limit) {
      let remaining = limit - (enqueued + deduped);
      const configs = await ctx.db.query("discordServerConfigs").collect();
      for (const config of configs) {
        if (remaining <= 0) break;
        if (!config.seatEnforcementEnabled) continue;
        const snapshot = await getSnapshotByKey(ctx, {
          tenantKey: config.tenantKey,
          connectorId: config.connectorId,
          guildId: config.guildId,
        });
        if (snapshot) continue;
        const result = await enqueueSeatAuditJobForServer(ctx, {
          tenantKey: config.tenantKey,
          connectorId: config.connectorId,
          guildId: config.guildId,
          source: "scheduled_missing_snapshot",
          now,
        });
        if (!result.enqueued) continue;
        if (result.deduped) deduped += 1;
        else enqueued += 1;
        remaining -= 1;
      }
    }

    if (enqueued > 0 || deduped > 0) {
      console.info(
        `[seat-audit] scheduled enqueue run enqueued=${enqueued} deduped=${deduped} now=${now}`,
      );
    }
    return { enqueued, deduped };
  },
});
