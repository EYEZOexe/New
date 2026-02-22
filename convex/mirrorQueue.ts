import type { MutationCtx } from "./_generated/server";

export const DEFAULT_SIGNAL_MIRROR_MAX_ATTEMPTS = 8;

export type SignalMirrorEventType = "create" | "update" | "delete";

type SignalAttachment = {
  attachmentId?: string;
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
};

function uniqueChannelIds(channelIds: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const channelId of channelIds) {
    const normalized = channelId.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

export function getMirrorBotTokenFromEnv(): string | null {
  const dedicated = process.env.MIRROR_BOT_TOKEN?.trim() ?? "";
  if (dedicated) return dedicated;

  const shared = process.env.ROLE_SYNC_BOT_TOKEN?.trim() ?? "";
  return shared || null;
}

async function enqueueMirrorJobForTarget(
  ctx: MutationCtx,
  args: {
    tenantKey: string;
    connectorId: string;
    sourceMessageId: string;
    sourceChannelId: string;
    sourceGuildId: string;
    targetChannelId: string;
    targetGuildId?: string;
    eventType: SignalMirrorEventType;
    content: string;
    attachments: SignalAttachment[];
    sourceCreatedAt: number;
    sourceEditedAt?: number;
    sourceDeletedAt?: number;
    now: number;
  },
): Promise<
  | { enqueued: true; deduped: boolean; jobId: string; targetChannelId: string }
  | { enqueued: false; reason: "invalid_target_channel_id" }
> {
  const targetChannelId = args.targetChannelId.trim();
  if (!targetChannelId) {
    return { enqueued: false, reason: "invalid_target_channel_id" };
  }
  const targetGuildId = args.targetGuildId?.trim();

  const statuses: Array<"pending" | "processing"> = ["pending", "processing"];
  for (const status of statuses) {
    const existing = await ctx.db
      .query("signalMirrorJobs")
      .withIndex("by_dedupe", (q) =>
        q
          .eq("tenantKey", args.tenantKey)
          .eq("connectorId", args.connectorId)
          .eq("sourceMessageId", args.sourceMessageId)
          .eq("targetChannelId", targetChannelId)
          .eq("eventType", args.eventType)
          .eq("status", status),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceChannelId: args.sourceChannelId,
        sourceGuildId: args.sourceGuildId,
        content: args.content,
        attachments: args.attachments,
        sourceCreatedAt: args.sourceCreatedAt,
        sourceEditedAt: args.sourceEditedAt,
        sourceDeletedAt: args.sourceDeletedAt,
        targetGuildId,
        ...(status === "pending"
          ? { runAfter: Math.min(existing.runAfter, args.now) }
          : {}),
        updatedAt: args.now,
      });
      return {
        enqueued: true,
        deduped: true,
        jobId: existing._id,
        targetChannelId,
      };
    }
  }

  const insertedId = await ctx.db.insert("signalMirrorJobs", {
    tenantKey: args.tenantKey,
    connectorId: args.connectorId,
    sourceMessageId: args.sourceMessageId,
    sourceChannelId: args.sourceChannelId,
    sourceGuildId: args.sourceGuildId,
    targetChannelId,
    targetGuildId,
    eventType: args.eventType,
    content: args.content,
    attachments: args.attachments,
    sourceCreatedAt: args.sourceCreatedAt,
    sourceEditedAt: args.sourceEditedAt,
    sourceDeletedAt: args.sourceDeletedAt,
    status: "pending",
    attemptCount: 0,
    maxAttempts: DEFAULT_SIGNAL_MIRROR_MAX_ATTEMPTS,
    runAfter: args.now,
    createdAt: args.now,
    updatedAt: args.now,
  });

  return {
    enqueued: true,
    deduped: false,
    jobId: insertedId,
    targetChannelId,
  };
}

export async function enqueueMirrorJobsForSignal(
  ctx: MutationCtx,
  args: {
    tenantKey: string;
    connectorId: string;
    sourceMessageId: string;
    sourceChannelId: string;
    sourceGuildId: string;
    targets: Array<{
      targetChannelId: string;
      targetGuildId?: string;
    }>;
    eventType: SignalMirrorEventType;
    content: string;
    attachments: SignalAttachment[];
    sourceCreatedAt: number;
    sourceEditedAt?: number;
    sourceDeletedAt?: number;
    now: number;
  },
): Promise<{
  enqueued: number;
  deduped: number;
  skipped: number;
}> {
  const targetChannelIds = uniqueChannelIds(
    args.targets.map((target) => target.targetChannelId),
  );
  if (targetChannelIds.length === 0) {
    return { enqueued: 0, deduped: 0, skipped: 1 };
  }

  const targetGuildIdByChannel = new Map(
    args.targets.map((target) => [
      target.targetChannelId.trim(),
      target.targetGuildId?.trim() || undefined,
    ]),
  );

  let enqueued = 0;
  let deduped = 0;
  let skipped = 0;

  for (const targetChannelId of targetChannelIds) {
    const result = await enqueueMirrorJobForTarget(ctx, {
      tenantKey: args.tenantKey,
      connectorId: args.connectorId,
      sourceMessageId: args.sourceMessageId,
      sourceChannelId: args.sourceChannelId,
      sourceGuildId: args.sourceGuildId,
      targetChannelId,
      targetGuildId: targetGuildIdByChannel.get(targetChannelId),
      eventType: args.eventType,
      content: args.content,
      attachments: args.attachments,
      sourceCreatedAt: args.sourceCreatedAt,
      sourceEditedAt: args.sourceEditedAt,
      sourceDeletedAt: args.sourceDeletedAt,
      now: args.now,
    });
    if (!result.enqueued) {
      skipped += 1;
      continue;
    }
    if (result.deduped) {
      deduped += 1;
    } else {
      enqueued += 1;
    }
  }

  return { enqueued, deduped, skipped };
}

export function nextMirrorRetryAt(now: number, attemptCount: number): number {
  const baseMs = 5000;
  const exponent = Math.max(0, attemptCount - 1);
  const delay = Math.min(15 * 60 * 1000, baseMs * 2 ** exponent);
  return now + delay;
}
