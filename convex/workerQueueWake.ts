import { v } from "convex/values";

import { query } from "./_generated/server";

function assertWorkerWakeTokenOrThrow(token: string) {
  const roleToken = process.env.ROLE_SYNC_BOT_TOKEN?.trim() ?? "";
  const mirrorToken = process.env.MIRROR_BOT_TOKEN?.trim() ?? "";
  const allowed = new Set([roleToken, mirrorToken].filter((value) => value.length > 0));
  if (allowed.size === 0) {
    throw new Error("worker_wake_token_not_configured");
  }
  if (!allowed.has(token)) {
    throw new Error("unauthorized");
  }
}

type QueueSummary = {
  pendingReady: number;
  nextRunAfter: number | null;
  pendingTotal: number;
  wakeUpdatedAt: number | null;
};

function summarizePendingJobs(
  rows: Array<{ runAfter: number; updatedAt: number }>,
  now: number,
): QueueSummary {
  let pendingReady = 0;
  let nextRunAfter: number | null = null;
  let wakeUpdatedAt: number | null = null;

  for (const row of rows) {
    if (row.runAfter <= now) pendingReady += 1;
    if (nextRunAfter === null || row.runAfter < nextRunAfter) {
      nextRunAfter = row.runAfter;
    }
    if (wakeUpdatedAt === null || row.updatedAt > wakeUpdatedAt) {
      wakeUpdatedAt = row.updatedAt;
    }
  }

  return {
    pendingReady,
    nextRunAfter,
    pendingTotal: rows.length,
    wakeUpdatedAt,
  };
}

export const getWorkerQueueWakeState = query({
  args: {
    botToken: v.string(),
  },
  handler: async (ctx, args) => {
    assertWorkerWakeTokenOrThrow(args.botToken);

    const now = Date.now();
    const [mirrorPending, rolePending] = await Promise.all([
      ctx.db
        .query("signalMirrorJobs")
        .withIndex("by_status_runAfter", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("roleSyncJobs")
        .withIndex("by_status_runAfter", (q) => q.eq("status", "pending"))
        .collect(),
    ]);

    const mirror = summarizePendingJobs(mirrorPending, now);
    const role = summarizePendingJobs(rolePending, now);

    return {
      mirror,
      role,
      serverNow: now,
    };
  },
});
