import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type WorkerQueueWakeState = {
  mirror: {
    pendingReady: number;
    nextRunAfter: number | null;
    pendingTotal: number;
    wakeUpdatedAt: number | null;
  };
  role: {
    pendingReady: number;
    nextRunAfter: number | null;
    pendingTotal: number;
    wakeUpdatedAt: number | null;
  };
  serverNow: number;
};

export type WakeDelayReason = "ready_jobs" | "next_due" | "fallback";

export type WakeDelayResult = {
  delayMs: number;
  reason: WakeDelayReason;
};

export type WakeEventSource = "initial_snapshot" | "realtime_update";

function jitterMs(minMs: number, maxMs: number, random: () => number): number {
  if (maxMs <= minMs) return minMs;
  const value = minMs + Math.floor((maxMs - minMs) * random());
  return Math.max(minMs, Math.min(maxMs, value));
}

function minNextDueAt(state: WorkerQueueWakeState): number | null {
  const dueTimes = [state.mirror.nextRunAfter, state.role.nextRunAfter].filter(
    (value): value is number => typeof value === "number",
  );
  if (dueTimes.length === 0) return null;
  return Math.min(...dueTimes);
}

export function computeQueueWakeDelayMs(args: {
  state: WorkerQueueWakeState | null;
  connectionHealthy: boolean;
  fallbackMinMs: number;
  fallbackMaxMs: number;
  random?: () => number;
}): WakeDelayResult {
  const random = args.random ?? Math.random;
  const fallback = () => ({
    delayMs: jitterMs(args.fallbackMinMs, args.fallbackMaxMs, random),
    reason: "fallback" as const,
  });

  if (!args.connectionHealthy || !args.state) {
    return fallback();
  }

  const pendingReady = args.state.mirror.pendingReady + args.state.role.pendingReady;
  if (pendingReady > 0) {
    return { delayMs: 0, reason: "ready_jobs" };
  }

  const nextDueAt = minNextDueAt(args.state);
  if (typeof nextDueAt === "number") {
    return {
      delayMs: Math.max(0, nextDueAt - args.state.serverNow),
      reason: "next_due",
    };
  }

  return fallback();
}

export class QueueWakeClient {
  private readonly client: ConvexClient;
  private readonly botToken: string;
  private readonly fallbackMinMs: number;
  private readonly fallbackMaxMs: number;

  private unsubscribeWake: (() => void) | null = null;
  private unsubscribeConnection: (() => void) | null = null;
  private latestState: WorkerQueueWakeState | null = null;
  private connectionHealthy = false;

  private readonly wakeQueryRef = makeFunctionReference<
    "query",
    { botToken: string },
    WorkerQueueWakeState
  >("workerQueueWake:getWorkerQueueWakeState");

  constructor(args: {
    convexUrl: string;
    botToken: string;
    fallbackMinMs: number;
    fallbackMaxMs: number;
  }) {
    this.client = new ConvexClient(args.convexUrl);
    this.botToken = args.botToken;
    this.fallbackMinMs = args.fallbackMinMs;
    this.fallbackMaxMs = args.fallbackMaxMs;
  }

  start(callbacks: {
    onWakeState: (state: WorkerQueueWakeState, source: WakeEventSource) => void;
    onError?: (error: Error) => void;
    onConnectionHealthyChange?: (healthy: boolean) => void;
  }): void {
    const reportError = (error: Error) => {
      if (callbacks.onError) callbacks.onError(error);
    };

    this.unsubscribeConnection = this.client.subscribeToConnectionState((state) => {
      const healthy = state.isWebSocketConnected;
      if (healthy !== this.connectionHealthy) {
        this.connectionHealthy = healthy;
        callbacks.onConnectionHealthyChange?.(healthy);
      }
    });

    const wakeUnsubscribe = this.client.onUpdate(
      this.wakeQueryRef,
      { botToken: this.botToken },
      (state) => {
        this.latestState = state;
        callbacks.onWakeState(state, "realtime_update");
      },
      (error) => reportError(error),
    );
    this.unsubscribeWake = () => wakeUnsubscribe.unsubscribe();

    void this.client
      .query(this.wakeQueryRef, { botToken: this.botToken })
      .then((state) => {
        this.latestState = state;
        callbacks.onWakeState(state, "initial_snapshot");
      })
      .catch((error: unknown) => {
        reportError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  getLatestState(): WorkerQueueWakeState | null {
    return this.latestState;
  }

  isConnectionHealthy(): boolean {
    return this.connectionHealthy;
  }

  getNextWakeDelay(random?: () => number): WakeDelayResult {
    return computeQueueWakeDelayMs({
      state: this.latestState,
      connectionHealthy: this.connectionHealthy,
      fallbackMinMs: this.fallbackMinMs,
      fallbackMaxMs: this.fallbackMaxMs,
      random,
    });
  }

  async stop(): Promise<void> {
    if (this.unsubscribeWake) this.unsubscribeWake();
    if (this.unsubscribeConnection) this.unsubscribeConnection();
    this.unsubscribeWake = null;
    this.unsubscribeConnection = null;
    await this.client.close();
  }
}
