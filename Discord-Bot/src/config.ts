export type BotConfig = {
  discordBotToken: string;
  convexUrl: string;
  roleSyncBotToken: string;
  mirrorBotToken: string;
  queueWakeBotToken: string;
  workerId: string;
  queueWakeFallbackMinMs: number;
  queueWakeFallbackMaxMs: number;
  roleSyncClaimLimit: number;
  mirrorClaimLimit: number;
  seatAuditClaimLimit: number;
  seatAuditPollIntervalMs: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

function parseIntEnv(
  name: string,
  fallback: number,
  args: { min: number; max: number },
): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < args.min || parsed > args.max) {
    throw new Error(`invalid_env:${name}`);
  }
  return parsed;
}

export function loadBotConfig(): BotConfig {
  const roleSyncBotToken = requiredEnv("ROLE_SYNC_BOT_TOKEN");
  const dedicatedMirrorToken = process.env.MIRROR_BOT_TOKEN?.trim() ?? "";
  const queueWakeFallbackMinMs = parseIntEnv("QUEUE_WAKE_FALLBACK_MIN_MS", 250, {
    min: 50,
    max: 5000,
  });
  const queueWakeFallbackMaxMs = parseIntEnv("QUEUE_WAKE_FALLBACK_MAX_MS", 1000, {
    min: 100,
    max: 10000,
  });
  if (queueWakeFallbackMaxMs < queueWakeFallbackMinMs) {
    throw new Error("invalid_env:QUEUE_WAKE_FALLBACK_MAX_MS");
  }

  return {
    discordBotToken: requiredEnv("DISCORD_BOT_TOKEN"),
    convexUrl: requiredEnv("CONVEX_URL"),
    roleSyncBotToken,
    mirrorBotToken: dedicatedMirrorToken || roleSyncBotToken,
    queueWakeBotToken: dedicatedMirrorToken || roleSyncBotToken,
    workerId:
      process.env.DISCORD_BOT_WORKER_ID?.trim() || `discord-worker-${process.pid}`,
    queueWakeFallbackMinMs,
    queueWakeFallbackMaxMs,
    roleSyncClaimLimit: parseIntEnv("ROLE_SYNC_CLAIM_LIMIT", 5, {
      min: 1,
      max: 20,
    }),
    mirrorClaimLimit: parseIntEnv("MIRROR_CLAIM_LIMIT", 10, {
      min: 1,
      max: 20,
    }),
    seatAuditClaimLimit: parseIntEnv("SEAT_AUDIT_CLAIM_LIMIT", 3, {
      min: 1,
      max: 20,
    }),
    seatAuditPollIntervalMs: parseIntEnv("SEAT_AUDIT_POLL_INTERVAL_MS", 30_000, {
      min: 5_000,
      max: 300_000,
    }),
  };
}
