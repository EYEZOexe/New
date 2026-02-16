import { z } from "zod";

export const DISCORD_OAUTH_STATE_COOKIE = "discord_oauth_state";
export const DISCORD_OAUTH_RESULT_COOKIE = "discord_oauth_result";
export const DISCORD_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const DISCORD_OAUTH_RESULT_TTL_MS = 10 * 60 * 1000;

const discordOAuthStateSchema = z.object({
  state: z.string().min(8),
  redirectPath: z.string().min(1),
  issuedAt: z.number().int().nonnegative(),
});

const discordOAuthResultSchema = z.object({
  discordUserId: z.string().min(1),
  username: z.string().nullable(),
  receivedAt: z.number().int().nonnegative(),
});

type DiscordOAuthState = z.infer<typeof discordOAuthStateSchema>;
type DiscordOAuthResult = z.infer<typeof discordOAuthResultSchema>;

export function sanitizeRedirectPath(rawPath: string | null | undefined): string {
  const path = (rawPath ?? "").trim();
  if (!path) return "/dashboard";
  if (!path.startsWith("/")) return "/dashboard";
  if (path.startsWith("//")) return "/dashboard";
  return path;
}

export function generateDiscordOAuthState(): string {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

export function buildDiscordAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", args.state);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export function encodeDiscordOAuthStateCookie(payload: DiscordOAuthState): string {
  return JSON.stringify(payload);
}

export function parseDiscordOAuthStateCookie(raw: string | null | undefined): DiscordOAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = discordOAuthStateSchema.safeParse(parsed);
    if (!result.success) return null;

    return {
      ...result.data,
      redirectPath: sanitizeRedirectPath(result.data.redirectPath),
    };
  } catch {
    return null;
  }
}

export function encodeDiscordOAuthResultCookie(payload: DiscordOAuthResult): string {
  return JSON.stringify(payload);
}

export function parseDiscordOAuthResultCookie(
  raw: string | null | undefined,
): DiscordOAuthResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = discordOAuthResultSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

export function isFreshDiscordOAuthTimestamp(args: {
  timestamp: number;
  now: number;
  ttlMs: number;
}): boolean {
  if (args.timestamp > args.now) return false;
  return args.now - args.timestamp <= args.ttlMs;
}

export function parseDiscordOAuthProfile(payload: unknown): {
  discordUserId: string;
  username: string | null;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const row = payload as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;

  const globalName = typeof row.global_name === "string" ? row.global_name.trim() : "";
  const username = typeof row.username === "string" ? row.username.trim() : "";
  return {
    discordUserId: id,
    username: globalName || username || null,
  };
}

