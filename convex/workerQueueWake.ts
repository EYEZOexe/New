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

async function summarizePendingJobsFromEarliest(
  loadEarliestPending: () => Promise<Array<{ runAfter: number; updatedAt: number }>>,
  now: number,
): Promise<QueueSummary> {
  // The wake scheduler only needs a minimal summary: whether any job is ready
  // immediately and when the next pending job becomes due. Reading only the
  // earliest pending row avoids full-queue scans on every wake-state update.
  const [earliest] = await loadEarliestPending();
  if (!earliest) {
    return {
      pendingReady: 0,
      nextRunAfter: null,
      pendingTotal: 0,
      wakeUpdatedAt: null,
    };
  }

  return {
    pendingReady: earliest.runAfter <= now ? 1 : 0,
    nextRunAfter: earliest.runAfter,
    // Wake state is consumed as a scheduling hint, not an admin stats surface.
    // Returning a lower bound here preserves low-latency wake behavior without
    // loading every pending row from SQLite on each realtime update.
    pendingTotal: 1,
    wakeUpdatedAt: earliest.updatedAt,
  };
}

export const getWorkerQueueWakeState = query({
  args: {
    botToken: v.string(),
  },
  handler: async (ctx, args) => {
    assertWorkerWakeTokenOrThrow(args.botToken);

    const now = Date.now();
    const [mirror, role] = await Promise.all([
      summarizePendingJobsFromEarliest(
        () =>
          ctx.db
            .query("signalMirrorJobs")
            .withIndex("by_status_runAfter", (q) => q.eq("status", "pending"))
            .order("asc")
            .take(1),
        now,
      ),
      summarizePendingJobsFromEarliest(
        () =>
          ctx.db
            .query("roleSyncJobs")
            .withIndex("by_status_runAfter", (q) => q.eq("status", "pending"))
            .order("asc")
            .take(1),
        now,
      ),
    ]);

    return {
      mirror,
      role,
      serverNow: now,
    };
  },
});
