import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { isLikelyImageAttachment } from "./imageDetection";
import { enqueueMirrorJobsForSignal } from "./mirrorQueue";

type SignalAttachment = {
  attachmentId?: string;
  url: string;
  storageId?: Id<"_storage">;
  mirrorUrl?: string;
  name?: string;
  contentType?: string;
  size?: number;
};

type HydrationStatus = "ready" | "failed";

type HydrationResult = {
  attachmentKey: string;
  sourceUrl: string;
  status: HydrationStatus;
  storageId?: Id<"_storage">;
  mirrorUrl?: string;
  contentType?: string;
  error?: string;
};

type HydrationPerf = {
  fetchMs: number;
  blobMs: number;
  storeMs: number;
  getUrlMs: number;
  totalMs: number;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
const HYDRATION_CONCURRENCY = 3;
const MIRROR_URL_RETRY_DELAYS_MS = [0, 25, 75];

const applyHydratedSignalMediaRef = makeFunctionReference<
  "mutation",
  {
    tenantKey: string;
    connectorId: string;
    sourceMessageId: string;
    results: HydrationResult[];
    receivedAt: number;
    hydrationStartedAt: number;
    hydrationCompletedAt: number;
    now: number;
  },
  {
    applied: number;
  }
>("mirrorMedia:applyHydratedSignalMedia");

const hydrateSignalMediaForMessageRef = makeFunctionReference<
  "action",
  {
    tenantKey: string;
    connectorId: string;
    sourceMessageId: string;
    sourceChannelId: string;
    receivedAt: number;
    attachments: Array<{
      attachmentId?: string;
      url: string;
      storageId?: Id<"_storage">;
      mirrorUrl?: string;
      name?: string;
      contentType?: string;
      size?: number;
    }>;
  },
  {
    ok: boolean;
    hydrated: number;
    failed: number;
    skipped: number;
  }
>("mirrorMedia:hydrateSignalMediaForMessage");

export const hydrateSignalMediaForMessage = internalAction({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceMessageId: v.string(),
    sourceChannelId: v.string(),
    receivedAt: v.number(),
    attachments: v.array(
      v.object({
        attachmentId: v.optional(v.string()),
        url: v.string(),
        storageId: v.optional(v.id("_storage")),
        mirrorUrl: v.optional(v.string()),
        name: v.optional(v.string()),
        contentType: v.optional(v.string()),
        size: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const candidates = args.attachments.filter((attachment) => {
      if (!isLikelyImageAttachment(attachment)) return false;
      if (attachment.mirrorUrl?.trim()) return false;
      return buildAttachmentKey(attachment).length > 0;
    });
    const storageRecoveryCandidates = candidates.filter((attachment) =>
      Boolean(attachment.storageId),
    ).length;

    if (candidates.length === 0) {
      return {
        ok: true,
        hydrated: 0,
        failed: 0,
        skipped: args.attachments.length,
      };
    }

    const results: HydrationResult[] = [];
    const perfByAttachment: Array<{ attachmentKey: string; perf: HydrationPerf }> = [];
    let storageRecoveryHydrated = 0;
    for (
      let index = 0;
      index < candidates.length;
      index += HYDRATION_CONCURRENCY
    ) {
      const batch = candidates.slice(index, index + HYDRATION_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map(async (attachment) => {
          const attachmentKey = buildAttachmentKey(attachment);
          const sourceUrl = attachment.url.trim();
          if (!attachmentKey || !sourceUrl) {
            return null;
          }

          const hydrated = attachment.storageId
            ? await resolveMirrorUrlForStoredImage(ctx, {
                storageId: attachment.storageId,
                contentType: attachment.contentType,
              })
            : await hydrateSingleImage(ctx, {
                sourceUrl,
                contentType: attachment.contentType,
              });

          return {
            attachmentKey,
            sourceUrl,
            hydrated,
          };
        }),
      );

      for (let offset = 0; offset < settled.length; offset += 1) {
        const outcome = settled[offset];
        const attachment = batch[offset];
        const attachmentKey = buildAttachmentKey(attachment);
        const sourceUrl = attachment.url.trim();
        if (!attachmentKey || !sourceUrl) continue;

        if (outcome.status === "fulfilled") {
          if (!outcome.value) continue;
          if (attachment.storageId) {
            storageRecoveryHydrated += 1;
          }
          perfByAttachment.push({ attachmentKey, perf: outcome.value.hydrated.perf });
          results.push({
            attachmentKey,
            sourceUrl,
            status: "ready",
            storageId: outcome.value.hydrated.storageId,
            mirrorUrl: outcome.value.hydrated.mirrorUrl ?? undefined,
            contentType: outcome.value.hydrated.contentType ?? undefined,
          });
          continue;
        }

        results.push({
          attachmentKey,
          sourceUrl,
          status: "failed",
          error: formatError(outcome.reason),
        });
      }
    }

    if (results.length > 0) {
      const applyStartedAt = Date.now();
      await ctx.runMutation(applyHydratedSignalMediaRef, {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        sourceMessageId: args.sourceMessageId,
        results,
        receivedAt: args.receivedAt,
        hydrationStartedAt: startedAt,
        hydrationCompletedAt: Date.now(),
        now: Date.now(),
      });
      const applyElapsedMs = Date.now() - applyStartedAt;
      console.info(
        `[mirror-media] apply mutation timing source_message=${args.sourceMessageId} apply_elapsed_ms=${applyElapsedMs}`,
      );
    }

    const hydrated = results.filter((result) => result.status === "ready").length;
    const failed = results.filter((result) => result.status === "failed").length;
    const elapsedMs = Date.now() - startedAt;
    const schedulerDelayMs = Math.max(0, startedAt - args.receivedAt);
    const perfTotals = perfByAttachment.reduce(
      (acc, row) => {
        acc.fetchMs += row.perf.fetchMs;
        acc.blobMs += row.perf.blobMs;
        acc.storeMs += row.perf.storeMs;
        acc.getUrlMs += row.perf.getUrlMs;
        acc.totalMs += row.perf.totalMs;
        return acc;
      },
      { fetchMs: 0, blobMs: 0, storeMs: 0, getUrlMs: 0, totalMs: 0 },
    );
    const avgAttachmentMs =
      perfByAttachment.length > 0
        ? Math.round(perfTotals.totalMs / perfByAttachment.length)
        : 0;
    const maxAttachmentMs = perfByAttachment.reduce(
      (max, row) => Math.max(max, row.perf.totalMs),
      0,
    );
    console.info(
      `[mirror-media] hydrated source_message=${args.sourceMessageId} source_channel=${args.sourceChannelId} candidates=${candidates.length} hydrated=${hydrated} failed=${failed} storage_recovery_candidates=${storageRecoveryCandidates} storage_recovery_hydrated=${storageRecoveryHydrated} scheduler_delay_ms=${schedulerDelayMs} elapsed_ms=${elapsedMs} fetch_ms_total=${perfTotals.fetchMs} blob_ms_total=${perfTotals.blobMs} store_ms_total=${perfTotals.storeMs} get_url_ms_total=${perfTotals.getUrlMs} avg_attachment_ms=${avgAttachmentMs} max_attachment_ms=${maxAttachmentMs}`,
    );

    return {
      ok: true,
      hydrated,
      failed,
      skipped: args.attachments.length - candidates.length,
    };
  },
});

export const applyHydratedSignalMedia = internalMutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceMessageId: v.string(),
    results: v.array(
      v.object({
        attachmentKey: v.string(),
        sourceUrl: v.string(),
        status: v.union(v.literal("ready"), v.literal("failed")),
        storageId: v.optional(v.id("_storage")),
        mirrorUrl: v.optional(v.string()),
        contentType: v.optional(v.string()),
        error: v.optional(v.string()),
      }),
    ),
    receivedAt: v.number(),
    hydrationStartedAt: v.number(),
    hydrationCompletedAt: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.results.length === 0) {
      return { applied: 0 };
    }

    const resultByKey = new Map(args.results.map((result) => [result.attachmentKey, result] as const));

    for (const result of args.results) {
      const existing = await ctx.db
        .query("signalMirrorMedia")
        .withIndex("by_attachment", (q) =>
          q
            .eq("tenantKey", args.tenantKey)
            .eq("connectorId", args.connectorId)
            .eq("sourceMessageId", args.sourceMessageId)
            .eq("attachmentKey", result.attachmentKey),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("signalMirrorMedia", {
          tenantKey: args.tenantKey,
          connectorId: args.connectorId,
          sourceMessageId: args.sourceMessageId,
          attachmentKey: result.attachmentKey,
          sourceUrl: result.sourceUrl,
          contentType: result.contentType,
          storageId: result.storageId,
          mirrorUrl: result.mirrorUrl,
          status: result.status,
          attemptCount: 1,
          lastError: result.error,
          createdAt: args.now,
          updatedAt: args.now,
        });
      } else {
        await ctx.db.patch(existing._id, {
          sourceUrl: result.sourceUrl,
          contentType: result.contentType ?? existing.contentType,
          storageId: result.storageId ?? existing.storageId,
          mirrorUrl: result.mirrorUrl ?? existing.mirrorUrl,
          status: result.status,
          attemptCount: (existing.attemptCount ?? 0) + 1,
          lastError: result.error,
          updatedAt: args.now,
        });
      }
    }

    const signal = await ctx.db
      .query("signals")
      .withIndex("by_sourceMessageId", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("sourceMessageId", args.sourceMessageId),
      )
      .first();

    let applied = 0;
    let signalAttachmentsChanged = false;
    let nextSignalAttachments: SignalAttachment[] | null = null;
    if (signal?.attachments?.length) {
      const updated = applyResultsToAttachments(signal.attachments, resultByKey);
      if (updated.changed) {
        await ctx.db.patch(signal._id, {
          attachments: updated.attachments,
        });
        applied += 1;
        signalAttachmentsChanged = true;
        nextSignalAttachments = updated.attachments;
      }
    }

    const jobs = await ctx.db
      .query("signalMirrorJobs")
      .withIndex("by_tenant_connector_sourceMessageId", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("sourceMessageId", args.sourceMessageId),
      )
      .collect();
    const matchingJobs = jobs.filter(
      (job) => job.status === "pending" || job.status === "processing",
    );

    for (const job of matchingJobs) {
      const attachments = Array.isArray(job.attachments) ? job.attachments : [];
      if (attachments.length === 0) continue;
      const updated = applyResultsToAttachments(attachments, resultByKey);
      if (!updated.changed) continue;
      await ctx.db.patch(job._id, {
        attachments: updated.attachments,
        updatedAt: args.now,
      });
      applied += 1;
    }

    let mirrorUpdateEnqueued = 0;
    let mirrorUpdateDeduped = 0;
    let mirrorUpdateSkipped = 0;
    if (
      signal &&
      signalAttachmentsChanged &&
      nextSignalAttachments &&
      typeof signal.deletedAt !== "number"
    ) {
      const connector = await ctx.db
        .query("connectors")
        .withIndex("by_tenant_connectorId", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .first();
      const forwardingEnabled = connector?.forwardEnabled === true;

      if (forwardingEnabled) {
        const mappings = await ctx.db
          .query("connectorMappings")
          .withIndex("by_tenant_connector_sourceChannelId", (q) =>
            q
              .eq("tenantKey", args.tenantKey)
              .eq("connectorId", args.connectorId)
              .eq("sourceChannelId", signal.sourceChannelId),
          )
          .collect();

        const targets: Array<{ targetChannelId: string; targetGuildId?: string }> = [];
        for (const mapping of mappings) {
          const targetChannelId = mapping.targetChannelId.trim();
          if (!targetChannelId) continue;
          const existingMirror = await ctx.db
            .query("mirroredSignals")
            .withIndex("by_source_target", (q) =>
              q
                .eq("tenantKey", args.tenantKey)
                .eq("connectorId", args.connectorId)
                .eq("sourceMessageId", signal.sourceMessageId)
                .eq("targetChannelId", targetChannelId),
            )
            .first();
          targets.push({
            targetChannelId,
            targetGuildId: existingMirror.mirroredGuildId?.trim() || undefined,
          });
        }

        if (targets.length > 0) {
          const mirrorResult = await enqueueMirrorJobsForSignal(ctx, {
            tenantKey: args.tenantKey,
            connectorId: args.connectorId,
            sourceMessageId: signal.sourceMessageId,
            sourceChannelId: signal.sourceChannelId,
            sourceGuildId: signal.sourceGuildId,
            targets,
            eventType: "update",
            content: signal.content,
            attachments: nextSignalAttachments,
            sourceCreatedAt: signal.createdAt,
            sourceEditedAt: args.hydrationCompletedAt,
            sourceDeletedAt: undefined,
            now: args.now,
          });
          mirrorUpdateEnqueued = mirrorResult.enqueued;
          mirrorUpdateDeduped = mirrorResult.deduped;
          mirrorUpdateSkipped = mirrorResult.skipped;
        } else {
          mirrorUpdateSkipped = 1;
        }
      }
    }

    console.info(
      `[mirror-media] applied hydration source_message=${args.sourceMessageId} results=${args.results.length} rows_updated=${applied} signal_attachments_changed=${signalAttachmentsChanged} mirror_update_enqueued=${mirrorUpdateEnqueued} mirror_update_deduped=${mirrorUpdateDeduped} mirror_update_skipped=${mirrorUpdateSkipped} ingest_to_hydration_start_ms=${Math.max(0, args.hydrationStartedAt - args.receivedAt)} hydration_duration_ms=${Math.max(0, args.hydrationCompletedAt - args.hydrationStartedAt)} ingest_to_hydration_complete_ms=${Math.max(0, args.hydrationCompletedAt - args.receivedAt)}`,
    );
    return { applied };
  },
});

export const debugSourceMirrorState = internalQuery({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const [signal, mediaRows, jobs, mirrors] = await Promise.all([
      ctx.db
        .query("signals")
        .withIndex("by_sourceMessageId", (q) =>
          q
            .eq("tenantKey", args.tenantKey)
            .eq("connectorId", args.connectorId)
            .eq("sourceMessageId", args.sourceMessageId),
        )
        .first(),
      ctx.db
        .query("signalMirrorMedia")
        .withIndex("by_tenant_connector_sourceMessageId", (q) =>
          q
            .eq("tenantKey", args.tenantKey)
            .eq("connectorId", args.connectorId)
            .eq("sourceMessageId", args.sourceMessageId),
        )
        .collect(),
      ctx.db
        .query("signalMirrorJobs")
        .withIndex("by_tenant_connector_sourceMessageId", (q) =>
          q
            .eq("tenantKey", args.tenantKey)
            .eq("connectorId", args.connectorId)
            .eq("sourceMessageId", args.sourceMessageId),
        )
        .collect(),
      ctx.db
        .query("mirroredSignals")
        .withIndex("by_tenant_connector", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .collect(),
    ]);

    const filteredMirrors = mirrors.filter(
      (row) => row.sourceMessageId === args.sourceMessageId,
    );

    return {
      signal: signal
        ? {
            sourceMessageId: signal.sourceMessageId,
            sourceChannelId: signal.sourceChannelId,
            sourceGuildId: signal.sourceGuildId,
            createdAt: signal.createdAt,
            editedAt: signal.editedAt ?? null,
            deletedAt: signal.deletedAt ?? null,
            attachmentCount: signal.attachments?.length ?? 0,
            attachments: (signal.attachments ?? []).map((attachment) => ({
              attachmentId: attachment.attachmentId ?? null,
              url: attachment.url,
              contentType: attachment.contentType ?? null,
              size: attachment.size ?? null,
              storageId: attachment.storageId ?? null,
              mirrorUrl: attachment.mirrorUrl ?? null,
            })),
          }
        : null,
      mediaRows: mediaRows.map((row) => ({
        attachmentKey: row.attachmentKey,
        sourceUrl: row.sourceUrl,
        status: row.status,
        storageId: row.storageId ?? null,
        mirrorUrl: row.mirrorUrl ?? null,
        attemptCount: row.attemptCount,
        lastError: row.lastError ?? null,
        updatedAt: row.updatedAt,
      })),
      jobs: jobs
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((job) => ({
          jobId: job._id,
          eventType: job.eventType,
          status: job.status,
          targetChannelId: job.targetChannelId,
          attemptCount: job.attemptCount,
          runAfter: job.runAfter,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          lastError: job.lastError ?? null,
          attachmentCount: job.attachments?.length ?? 0,
          mirrorAttachmentCount:
            job.attachments?.filter((attachment) => {
              const mirrorUrl = attachment.mirrorUrl?.trim() ?? "";
              return mirrorUrl.length > 0;
            }).length ?? 0,
        })),
      mirrored: filteredMirrors.map((row) => ({
        targetChannelId: row.targetChannelId,
        mirroredMessageId: row.mirroredMessageId,
        mirroredExtraMessageIds: row.mirroredExtraMessageIds ?? [],
        mirroredGuildId: row.mirroredGuildId ?? null,
        lastMirroredAt: row.lastMirroredAt,
        deletedAt: row.deletedAt ?? null,
      })),
    };
  },
});

export const listUnresolvedImageSignals = internalQuery({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, args.limit ?? 50));
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_createdAt", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .order("desc")
      .take(Math.max(limit * 5, 250));

    const unresolved = rows
      .filter((row) => typeof row.deletedAt !== "number")
      .map((row) => {
        const attachments = row.attachments ?? [];
        const unresolvedImageAttachments = attachments.filter((attachment) => {
          if (!isLikelyImageAttachment(attachment)) return false;
          const hasMirror = (attachment.mirrorUrl?.trim() ?? "").length > 0;
          return !hasMirror;
        });
        return {
          sourceMessageId: row.sourceMessageId,
          sourceChannelId: row.sourceChannelId,
          createdAt: row.createdAt,
          editedAt: row.editedAt ?? null,
          unresolvedImageCount: unresolvedImageAttachments.length,
          attachments: unresolvedImageAttachments.map((attachment) => ({
            attachmentId: attachment.attachmentId ?? null,
            url: attachment.url,
            contentType: attachment.contentType ?? null,
            storageId: attachment.storageId ?? null,
            mirrorUrl: attachment.mirrorUrl ?? null,
          })),
        };
      })
      .filter((row) => row.unresolvedImageCount > 0)
      .slice(0, limit);

    const sourceMessageIds = unresolved.map((row) => row.sourceMessageId);
    const [mediaRows, jobRows] = await Promise.all([
      ctx.db
        .query("signalMirrorMedia")
        .withIndex("by_tenant_connector_sourceMessageId", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .collect(),
      ctx.db
        .query("signalMirrorJobs")
        .withIndex("by_tenant_connector", (q) =>
          q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
        )
        .collect(),
    ]);

    const mediaBySource = new Map<string, typeof mediaRows>();
    for (const row of mediaRows) {
      if (!sourceMessageIds.includes(row.sourceMessageId)) continue;
      const current = mediaBySource.get(row.sourceMessageId) ?? [];
      current.push(row);
      mediaBySource.set(row.sourceMessageId, current);
    }

    const jobsBySource = new Map<string, typeof jobRows>();
    for (const row of jobRows) {
      if (!sourceMessageIds.includes(row.sourceMessageId)) continue;
      const current = jobsBySource.get(row.sourceMessageId) ?? [];
      current.push(row);
      jobsBySource.set(row.sourceMessageId, current);
    }

    return unresolved.map((row) => {
      const media = mediaBySource.get(row.sourceMessageId) ?? [];
      const jobs = jobsBySource.get(row.sourceMessageId) ?? [];
      return {
        ...row,
        mediaRows: media.map((mediaRow) => ({
          status: mediaRow.status,
          attachmentKey: mediaRow.attachmentKey,
          storageId: mediaRow.storageId ?? null,
          mirrorUrl: mediaRow.mirrorUrl ?? null,
          attemptCount: mediaRow.attemptCount,
          updatedAt: mediaRow.updatedAt,
          lastError: mediaRow.lastError ?? null,
        })),
        jobs: jobs
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((job) => ({
            eventType: job.eventType,
            status: job.status,
            attemptCount: job.attemptCount,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            lastError: job.lastError ?? null,
            mirrorAttachmentCount:
              job.attachments?.filter((attachment) => {
                const mirrorUrl = attachment.mirrorUrl?.trim() ?? "";
                return mirrorUrl.length > 0;
              }).length ?? 0,
          })),
      };
    });
  },
});

export const backfillUnresolvedImageHydration = internalMutation({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, args.limit ?? 50));
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_createdAt", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .order("desc")
      .take(Math.max(limit * 5, 300));

    const unresolved = rows
      .filter((row) => typeof row.deletedAt !== "number")
      .map((row) => {
        const attachments = row.attachments ?? [];
        const unresolvedImageAttachments = attachments.filter((attachment) => {
          if (!isLikelyImageAttachment(attachment)) return false;
          const hasMirror = (attachment.mirrorUrl?.trim() ?? "").length > 0;
          return !hasMirror;
        });
        return {
          sourceMessageId: row.sourceMessageId,
          sourceChannelId: row.sourceChannelId,
          createdAt: row.createdAt,
          attachments: unresolvedImageAttachments,
        };
      })
      .filter((row) => row.attachments.length > 0)
      .slice(0, limit);

    for (const row of unresolved) {
      await ctx.scheduler.runAfter(0, hydrateSignalMediaForMessageRef, {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        sourceMessageId: row.sourceMessageId,
        sourceChannelId: row.sourceChannelId,
        receivedAt: Date.now(),
        attachments: row.attachments,
      });
    }

    console.info(
      `[mirror-media] backfill scheduled tenant=${args.tenantKey} connector=${args.connectorId} scheduled=${unresolved.length}`,
    );

    return {
      scheduled: unresolved.length,
      sourceMessageIds: unresolved.map((row) => row.sourceMessageId),
    };
  },
});

function applyResultsToAttachments(
  attachments: SignalAttachment[],
  resultByKey: Map<string, HydrationResult>,
): {
  attachments: SignalAttachment[];
  changed: boolean;
} {
  let changed = false;
  const patched = attachments.map((attachment) => {
    const key = buildAttachmentKey(attachment);
    if (!key) return attachment;
    const result = resultByKey.get(key);
    if (!result || result.status !== "ready" || !result.storageId) {
      return attachment;
    }

    const next: SignalAttachment = {
      ...attachment,
      storageId: result.storageId,
      ...(result.mirrorUrl?.trim() ? { mirrorUrl: result.mirrorUrl.trim() } : {}),
      ...(result.contentType?.trim() ? { contentType: result.contentType.trim() } : {}),
    };
    if (
      next.storageId !== attachment.storageId ||
      (next.mirrorUrl ?? "") !== (attachment.mirrorUrl ?? "") ||
      (next.contentType ?? "") !== (attachment.contentType ?? "")
    ) {
      changed = true;
    }
    return next;
  });
  return {
    attachments: patched,
    changed,
  };
}

async function hydrateSingleImage(
  ctx: Parameters<typeof hydrateSignalMediaForMessage["_handler"]>[0],
  args: { sourceUrl: string; contentType?: string },
): Promise<{
  storageId: Id<"_storage">;
  mirrorUrl: string | null;
  contentType: string | null;
  perf: HydrationPerf;
}> {
  const totalStartedAt = Date.now();
  const fetchStartedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(args.sourceUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  const fetchMs = Date.now() - fetchStartedAt;

  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new Error("image_too_large");
    }
  }

  const responseType = normalizeContentType(response.headers.get("content-type") ?? undefined);
  const fallbackType = normalizeContentType(args.contentType);
  const finalType = responseType ?? fallbackType;
  if (!finalType?.startsWith("image/")) {
    throw new Error("non_image_content");
  }

  const blobStartedAt = Date.now();
  const blob = await response.blob();
  const blobMs = Date.now() - blobStartedAt;
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("image_too_large");
  }

  const uploadBlob = blob.type ? blob : new Blob([blob], { type: finalType });
  const storeStartedAt = Date.now();
  const storageId = await ctx.storage.store(uploadBlob);
  const storeMs = Date.now() - storeStartedAt;
  const { mirrorUrl, elapsedMs: getUrlMs } = await getMirrorUrlWithRetry(ctx, storageId);
  const totalMs = Date.now() - totalStartedAt;
  return {
    storageId,
    mirrorUrl,
    contentType: finalType,
    perf: {
      fetchMs,
      blobMs,
      storeMs,
      getUrlMs,
      totalMs,
    },
  };
}

async function resolveMirrorUrlForStoredImage(
  ctx: Parameters<typeof hydrateSignalMediaForMessage["_handler"]>[0],
  args: { storageId: Id<"_storage">; contentType?: string },
): Promise<{
  storageId: Id<"_storage">;
  mirrorUrl: string | null;
  contentType: string | null;
  perf: HydrationPerf;
}> {
  const startedAt = Date.now();
  const { mirrorUrl, elapsedMs: getUrlMs } = await getMirrorUrlWithRetry(
    ctx,
    args.storageId,
  );
  return {
    storageId: args.storageId,
    mirrorUrl,
    contentType: normalizeContentType(args.contentType),
    perf: {
      fetchMs: 0,
      blobMs: 0,
      storeMs: 0,
      getUrlMs,
      totalMs: Date.now() - startedAt,
    },
  };
}

async function getMirrorUrlWithRetry(
  ctx: Parameters<typeof hydrateSignalMediaForMessage["_handler"]>[0],
  storageId: Id<"_storage">,
): Promise<{ mirrorUrl: string; elapsedMs: number }> {
  const startedAt = Date.now();
  for (let index = 0; index < MIRROR_URL_RETRY_DELAYS_MS.length; index += 1) {
    const delayMs = MIRROR_URL_RETRY_DELAYS_MS[index] ?? 0;
    if (delayMs > 0) {
      await wait(delayMs);
    }
    const candidate = await ctx.storage.getUrl(storageId);
    const normalized = candidate?.trim() ?? "";
    if (normalized) {
      return { mirrorUrl: normalized, elapsedMs: Date.now() - startedAt };
    }
  }

  throw new Error("mirror_url_unavailable");
}

async function wait(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function normalizeContentType(value?: string): string | null {
  if (!value) return null;
  const normalized = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function buildAttachmentKey(attachment: { attachmentId?: string; url: string }): string {
  const attachmentId = attachment.attachmentId?.trim() ?? "";
  if (attachmentId) return `id:${attachmentId}`;
  const url = attachment.url.trim();
  return url ? `url:${url}` : "";
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
