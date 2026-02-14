import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getAuthContext } from "../../../../../lib/auth";
import { getAppwritePublicConfig } from "../../../../../lib/appwrite-server";
import { makeOAuthState } from "../../../../../lib/discord-linking";
import { createAppwriteSessionRestClient } from "../../../../../lib/appwrite-session-rest";

const STATE_COOKIE = "discord_oauth_state";
const STATE_COOKIE_MAX_AGE_S = 10 * 60;

async function handler() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getAppwritePublicConfig();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(cfg.sessionCookieName)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = makeOAuthState();

  const h = await headers();
  const hostHeader = h.get("host") ?? "";
  const host = hostHeader.startsWith("[") ? hostHeader : hostHeader.split(":")[0];
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${hostHeader}`;
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

  const location = await session.startDiscordOAuthToken({ success, failure });

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

export async function GET() {
  return await handler();
}

export async function POST() {
  return await handler();
}

