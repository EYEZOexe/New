export type BotConfig = {
  discordBotToken: string;
  convexUrl: string;
  roleSyncBotToken: string;
  mirrorBotToken: string;
  workerId: string;
  pollIntervalMs: number;
  roleSyncClaimLimit: number;
  mirrorClaimLimit: number;
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

  return {
    discordBotToken: requiredEnv("DISCORD_BOT_TOKEN"),
    convexUrl: requiredEnv("CONVEX_URL"),
    roleSyncBotToken,
    mirrorBotToken: dedicatedMirrorToken || roleSyncBotToken,
    workerId:
      process.env.DISCORD_BOT_WORKER_ID?.trim() || `discord-worker-${process.pid}`,
    pollIntervalMs: parseIntEnv("ROLE_SYNC_POLL_INTERVAL_MS", 2000, {
      min: 500,
      max: 60000,
    }),
    roleSyncClaimLimit: parseIntEnv("ROLE_SYNC_CLAIM_LIMIT", 5, {
      min: 1,
      max: 20,
    }),
    mirrorClaimLimit: parseIntEnv("MIRROR_CLAIM_LIMIT", 10, {
      min: 1,
      max: 20,
    }),
  };
}
