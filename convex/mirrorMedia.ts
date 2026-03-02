import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";

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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

const applyHydratedSignalMediaRef = makeFunctionReference<
  "mutation",
  {
    tenantKey: string;
    connectorId: string;
    sourceMessageId: string;
    results: HydrationResult[];
    now: number;
  },
  {
    applied: number;
  }
>("mirrorMedia:applyHydratedSignalMedia");

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
      if (attachment.storageId) return false;
      if (attachment.mirrorUrl?.trim()) return false;
      return buildAttachmentKey(attachment).length > 0;
    });

    if (candidates.length === 0) {
      return {
        ok: true,
        hydrated: 0,
        failed: 0,
        skipped: args.attachments.length,
      };
    }

    const results: HydrationResult[] = [];
    for (const attachment of candidates) {
      const attachmentKey = buildAttachmentKey(attachment);
      if (!attachmentKey) continue;
      const sourceUrl = attachment.url.trim();
      if (!sourceUrl) continue;

      try {
        const hydrated = await hydrateSingleImage(ctx, {
          sourceUrl,
          contentType: attachment.contentType,
        });
        results.push({
          attachmentKey,
          sourceUrl,
          status: "ready",
          storageId: hydrated.storageId,
          mirrorUrl: hydrated.mirrorUrl ?? undefined,
          contentType: hydrated.contentType ?? undefined,
        });
      } catch (error) {
        results.push({
          attachmentKey,
          sourceUrl,
          status: "failed",
          error: formatError(error),
        });
      }
    }

    if (results.length > 0) {
      await ctx.runMutation(applyHydratedSignalMediaRef, {
        tenantKey: args.tenantKey,
        connectorId: args.connectorId,
        sourceMessageId: args.sourceMessageId,
        results,
        now: Date.now(),
      });
    }

    const hydrated = results.filter((result) => result.status === "ready").length;
    const failed = results.filter((result) => result.status === "failed").length;
    const elapsedMs = Date.now() - startedAt;
    console.info(
      `[mirror-media] hydrated source_message=${args.sourceMessageId} source_channel=${args.sourceChannelId} candidates=${candidates.length} hydrated=${hydrated} failed=${failed} elapsed_ms=${elapsedMs}`,
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
    if (signal?.attachments?.length) {
      const updated = applyResultsToAttachments(signal.attachments, resultByKey);
      if (updated.changed) {
        await ctx.db.patch(signal._id, {
          attachments: updated.attachments,
        });
        applied += 1;
      }
    }

    const jobs = await ctx.db
      .query("signalMirrorJobs")
      .withIndex("by_tenant_connector", (q) =>
        q.eq("tenantKey", args.tenantKey).eq("connectorId", args.connectorId),
      )
      .collect();
    const matchingJobs = jobs.filter(
      (job) =>
        job.sourceMessageId === args.sourceMessageId &&
        (job.status === "pending" || job.status === "processing"),
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

    console.info(
      `[mirror-media] applied hydration source_message=${args.sourceMessageId} results=${args.results.length} rows_updated=${applied}`,
    );
    return { applied };
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
): Promise<{ storageId: Id<"_storage">; mirrorUrl: string | null; contentType: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(args.sourceUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

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

  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("image_too_large");
  }

  const uploadBlob = blob.type ? blob : new Blob([blob], { type: finalType });
  const storageId = await ctx.storage.store(uploadBlob);
  const mirrorUrl = await ctx.storage.getUrl(storageId);
  return {
    storageId,
    mirrorUrl,
    contentType: finalType,
  };
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

function isLikelyImageAttachment(attachment: { url: string; contentType?: string }): boolean {
  const type = normalizeContentType(attachment.contentType ?? undefined);
  if (type?.startsWith("image/")) return true;
  const lower = attachment.url.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".bmp")
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
