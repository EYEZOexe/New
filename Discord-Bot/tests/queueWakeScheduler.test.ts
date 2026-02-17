import { describe, expect, it } from "bun:test";

import { computeQueueWakeDelayMs } from "../src/queueWakeClient";

describe("queue wake scheduler", () => {
  it("wakes immediately when ready jobs exist", () => {
    const result = computeQueueWakeDelayMs({
      state: {
        mirror: {
          pendingReady: 1,
          nextRunAfter: null,
          pendingTotal: 1,
          wakeUpdatedAt: 1,
        },
        role: {
          pendingReady: 0,
          nextRunAfter: 2_000,
          pendingTotal: 1,
          wakeUpdatedAt: 1,
        },
        serverNow: 1_000,
      },
      connectionHealthy: true,
      fallbackMinMs: 250,
      fallbackMaxMs: 1_000,
      random: () => 0.5,
    });

    expect(result).toEqual({ delayMs: 0, reason: "ready_jobs" });
  });

  it("schedules wake from the nearest due timestamp when connected", () => {
    const result = computeQueueWakeDelayMs({
      state: {
        mirror: {
          pendingReady: 0,
          nextRunAfter: 1_700,
          pendingTotal: 1,
          wakeUpdatedAt: 10,
        },
        role: {
          pendingReady: 0,
          nextRunAfter: 2_100,
          pendingTotal: 1,
          wakeUpdatedAt: 11,
        },
        serverNow: 1_000,
      },
      connectionHealthy: true,
      fallbackMinMs: 250,
      fallbackMaxMs: 1_000,
      random: () => 0.5,
    });

    expect(result).toEqual({ delayMs: 700, reason: "next_due" });
  });

  it("falls back to bounded jitter polling when connection is disconnected", () => {
    const result = computeQueueWakeDelayMs({
      state: {
        mirror: {
          pendingReady: 1,
          nextRunAfter: null,
          pendingTotal: 1,
          wakeUpdatedAt: 1,
        },
        role: {
          pendingReady: 1,
          nextRunAfter: null,
          pendingTotal: 1,
          wakeUpdatedAt: 1,
        },
        serverNow: 1_000,
      },
      connectionHealthy: false,
      fallbackMinMs: 250,
      fallbackMaxMs: 1_000,
      random: () => 0.5,
    });

    expect(result).toEqual({ delayMs: 625, reason: "fallback" });
  });
});
