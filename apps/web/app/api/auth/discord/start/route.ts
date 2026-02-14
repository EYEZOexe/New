import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getAuthContext } from "../../../../../lib/auth";
import { getAppwritePublicConfig } from "../../../../../lib/appwrite-server";
import { makeOAuthState } from "../../../../../lib/discord-linking";
import { createAppwriteSessionRestClient } from "../../../../../lib/appwrite-session-rest";
import { getExternalOriginFromHeaders } from "../../../../../lib/external-request";

const STATE_COOKIE = "discord_oauth_state";
const STATE_COOKIE_MAX_AGE_S = 10 * 60;

function forceHttpsRedirectUri(location: string, appwriteHost: string): string {
  // Appwrite may generate an http:// callback URL when behind a proxy that reports http.
  // Discord requires https redirect URIs (except localhost), so we rewrite only when safe.
  try {
    const u = new URL(location);
    const redirectUri = u.searchParams.get("redirect_uri");
    if (!redirectUri) return location;

    let ru: URL;
    try {
      ru = new URL(redirectUri);
    } catch {
      return location;
    }

    if (ru.protocol !== "http:") return location;
    if (ru.hostname !== appwriteHost) return location;

    ru.protocol = "https:";
    u.searchParams.set("redirect_uri", ru.toString());
    return u.toString();
  } catch {
    return location;
  }
}

function redirectToDashboard(origin: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return NextResponse.redirect(new URL(`/dashboard${suffix}`, origin));
}

async function handler(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getAppwritePublicConfig();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(cfg.sessionCookieName)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = makeOAuthState();

  const h = await headers();
  const ext = getExternalOriginFromHeaders(h as any, process.env.NODE_ENV);
  const hostHeader = ext.hostHeader;
  const host = ext.host;
  const origin = ext.origin;
  const cookieDomain =
    cfg.cookieDomain && host.endsWith(cfg.cookieDomain.replace(/^\./, ""))
      ? cfg.cookieDomain
      : undefined;

  const success = `${origin}/api/auth/discord/complete?state=${encodeURIComponent(state)}`;
  const failure = `${origin}/dashboard?discord=link_failed`;

  const session = createAppwriteSessionRestClient({
    endpoint: cfg.endpoint,
    projectId: cfg.projectId,
    sessionToken
  });

  let location: string;
  try {
    location = await session.startDiscordOAuthToken({ success, failure });
  } catch (err: any) {
    const details = {
      message: err?.message ?? String(err),
      code: err?.code ?? null,
      type: err?.type ?? null,
      appwrite: {
        // Safe: Appwrite errors only. No cookies/tokens.
        response: err?.response ?? null,
        responseTextSnippet: err?.responseTextSnippet ?? null
      },
      request: {
        host: ext.raw.host,
        forwardedHost: ext.raw.forwardedHost,
        forwardedProto: ext.raw.forwardedProto,
        forwardedScheme: ext.raw.forwardedScheme,
        computedOrigin: ext.origin,
        warnings: ext.warnings
      }
    };

    // Safe server-side diagnostic. No tokens/cookies included.
    console.error("[discord-oauth-start] failed", details);

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1" || process.env.NODE_ENV !== "production";
    if (debug) {
      // Cloudflare often replaces 5xx bodies with its own HTML. Return 200 so we can see JSON.
      return NextResponse.json(
        { error: "Discord OAuth start failed", details },
        { status: 200, headers: { "cache-control": "no-store" } }
      );
    }

    const res = redirectToDashboard(ext.origin, { discord: "link_failed" });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  // Workaround for reverse proxies that report http to Appwrite (Cloudflare "Flexible", etc).
  // Preferred fix is to make Appwrite see x-forwarded-proto=https; this is a pragmatic safety net.
  location = forceHttpsRedirectUri(location, new URL(cfg.endpoint).hostname);

  const res = NextResponse.redirect(location);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE_S,
    ...(cookieDomain ? { domain: cookieDomain } : {})
  });

  // Prevent caching of redirects for auth flows.
  res.headers.set("cache-control", "no-store");
  return res;
}

export async function GET(req: Request) {
  return await handler(req);
}

export async function POST(req: Request) {
  return await handler(req);
}

