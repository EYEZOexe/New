import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const RETENTION_BATCH_LIMIT = 120;
const CONTINUATION_DELAY_MS = 1_000;

type RetentionSummary = {
  cutoffMs: number;
  continuation: boolean;
  scheduledContinuation: boolean;
  signalsDeleted: number;
  signalMirrorMediaDeleted: number;
  signalMirrorJobsDeleted: number;
  mirroredSignalsDeleted: number;
  webhookEventsDeleted: number;
  roleSyncJobsDeleted: number;
  seatAuditJobsDeleted: number;
  storageDeleted: number;
  storageDeleteErrors: number;
};

const runFourteenDayRetentionRef = makeFunctionReference<
  "mutation",
  {
    cutoffMs?: number;
    continuation?: boolean;
  },
  RetentionSummary
>("retention:runFourteenDayRetention");

function collectStorageIdsFromAttachments(
  attachments: Array<{ storageId?: Id<"_storage"> }> | undefined,
  bucket: Set<Id<"_storage">>,
) {
  for (const attachment of attachments ?? []) {
    if (attachment.storageId) {
      bucket.add(attachment.storageId);
    }
  }
}

export const runFourteenDayRetention = internalMutation({
  args: {
    cutoffMs: v.optional(v.number()),
    continuation: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<RetentionSummary> => {
    const now = Date.now();
    const cutoffMs =
      typeof args.cutoffMs === "number"
        ? args.cutoffMs
        : now - FOURTEEN_DAYS_MS;

    const summary: RetentionSummary = {
      cutoffMs,
      continuation: args.continuation === true,
      scheduledContinuation: false,
      signalsDeleted: 0,
      signalMirrorMediaDeleted: 0,
      signalMirrorJobsDeleted: 0,
      mirroredSignalsDeleted: 0,
      webhookEventsDeleted: 0,
      roleSyncJobsDeleted: 0,
      seatAuditJobsDeleted: 0,
      storageDeleted: 0,
      storageDeleteErrors: 0,
    };

    const storageIdsToDelete = new Set<Id<"_storage">>();
    let hasMore = false;

    const signalRows = await ctx.db
      .query("signals")
      .withIndex("by_createdAt_global", (q) => q.lte("createdAt", cutoffMs))
      .order("asc")
      .take(RETENTION_BATCH_LIMIT);
    if (signalRows.length === RETENTION_BATCH_LIMIT) {
      hasMore = true;
    }
    for (const row of signalRows) {
      collectStorageIdsFromAttachments(row.attachments, storageIdsToDelete);
      await ctx.db.delete(row._id);
      summary.signalsDeleted += 1;
    }

    const mediaStatuses = ["pending", "ready", "failed"] as const;
    for (const status of mediaStatuses) {
      const rows = await ctx.db
        .query("signalMirrorMedia")
        .withIndex("by_status_updatedAt", (q) =>
          q.eq("status", status).lte("updatedAt", cutoffMs),
        )
        .order("asc")
        .take(RETENTION_BATCH_LIMIT);
      if (rows.length === RETENTION_BATCH_LIMIT) {
        hasMore = true;
      }
      for (const row of rows) {
        if (row.storageId) {
          storageIdsToDelete.add(row.storageId);
        }
        await ctx.db.delete(row._id);
        summary.signalMirrorMediaDeleted += 1;
      }
    }

    const terminalMirrorStatuses = ["completed", "failed"] as const;
    for (const status of terminalMirrorStatuses) {
      const rows = await ctx.db
        .query("signalMirrorJobs")
        .withIndex("by_status_updatedAt", (q) =>
          q.eq("status", status).lte("updatedAt", cutoffMs),
        )
        .order("asc")
        .take(RETENTION_BATCH_LIMIT);
      if (rows.length === RETENTION_BATCH_LIMIT) {
        hasMore = true;
      }
      for (const row of rows) {
        await ctx.db.delete(row._id);
        summary.signalMirrorJobsDeleted += 1;
      }
    }

    const mirroredRows = await ctx.db
      .query("mirroredSignals")
      .withIndex("by_lastMirroredAt", (q) => q.lte("lastMirroredAt", cutoffMs))
      .order("asc")
      .take(RETENTION_BATCH_LIMIT);
    if (mirroredRows.length === RETENTION_BATCH_LIMIT) {
      hasMore = true;
    }
    for (const row of mirroredRows) {
      await ctx.db.delete(row._id);
      summary.mirroredSignalsDeleted += 1;
    }

    const webhookRows = await ctx.db
      .query("webhookEvents")
      .withIndex("by_receivedAt", (q) => q.lte("receivedAt", cutoffMs))
      .order("asc")
      .take(RETENTION_BATCH_LIMIT);
    if (webhookRows.length === RETENTION_BATCH_LIMIT) {
      hasMore = true;
    }
    for (const row of webhookRows) {
      await ctx.db.delete(row._id);
      summary.webhookEventsDeleted += 1;
    }

    const terminalRoleSyncStatuses = ["completed", "failed"] as const;
    for (const status of terminalRoleSyncStatuses) {
      const rows = await ctx.db
        .query("roleSyncJobs")
        .withIndex("by_status_updatedAt", (q) =>
          q.eq("status", status).lte("updatedAt", cutoffMs),
        )
        .order("asc")
        .take(RETENTION_BATCH_LIMIT);
      if (rows.length === RETENTION_BATCH_LIMIT) {
        hasMore = true;
      }
      for (const row of rows) {
        await ctx.db.delete(row._id);
        summary.roleSyncJobsDeleted += 1;
      }
    }

    const terminalSeatAuditStatuses = ["completed", "failed"] as const;
    for (const status of terminalSeatAuditStatuses) {
      const rows = await ctx.db
        .query("discordSeatAuditJobs")
        .withIndex("by_status_updatedAt", (q) =>
          q.eq("status", status).lte("updatedAt", cutoffMs),
        )
        .order("asc")
        .take(RETENTION_BATCH_LIMIT);
      if (rows.length === RETENTION_BATCH_LIMIT) {
        hasMore = true;
      }
      for (const row of rows) {
        await ctx.db.delete(row._id);
        summary.seatAuditJobsDeleted += 1;
      }
    }

    for (const storageId of storageIdsToDelete) {
      try {
        await ctx.storage.delete(storageId);
        summary.storageDeleted += 1;
      } catch (error) {
        summary.storageDeleteErrors += 1;
        console.warn(
          `[retention] storage delete failed storage_id=${storageId} error=${String(error)}`,
        );
      }
    }

    if (hasMore) {
      await ctx.scheduler.runAfter(CONTINUATION_DELAY_MS, runFourteenDayRetentionRef, {
        cutoffMs,
        continuation: true,
      });
      summary.scheduledContinuation = true;
    }

    console.info(
      `[retention] 14d cleanup cutoff=${cutoffMs} continuation=${summary.continuation} scheduled_continuation=${summary.scheduledContinuation} signals_deleted=${summary.signalsDeleted} media_deleted=${summary.signalMirrorMediaDeleted} mirror_jobs_deleted=${summary.signalMirrorJobsDeleted} mirrored_deleted=${summary.mirroredSignalsDeleted} webhook_events_deleted=${summary.webhookEventsDeleted} role_sync_jobs_deleted=${summary.roleSyncJobsDeleted} seat_audit_jobs_deleted=${summary.seatAuditJobsDeleted} storage_deleted=${summary.storageDeleted} storage_delete_errors=${summary.storageDeleteErrors}`,
    );

    return summary;
  },
});
