import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getAuthContext } from "../../../../../lib/auth";
import { makeOAuthState } from "../../../../../lib/discord-linking";
import { getExternalOriginFromHeaders } from "../../../../../lib/external-request";
import { getDiscordOAuthConfig } from "../../../../../lib/discord-oauth-client";

const STATE_COOKIE = "discord_oauth_state";
const STATE_COOKIE_MAX_AGE_S = 10 * 60;

function redirectToDashboard(origin: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return NextResponse.redirect(new URL(`/dashboard${suffix}`, origin));
}

async function handler(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();

  const state = makeOAuthState();

  const h = await headers();
  const ext = getExternalOriginFromHeaders(h as any, process.env.NODE_ENV);
  const origin = ext.origin;

  const { clientId } = getDiscordOAuthConfig();
  const redirectUri = new URL("/api/auth/discord/callback", origin).toString();

  const qs = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "identify",
    state
  });

  const location = `https://discord.com/oauth2/authorize?${qs.toString()}`;

  const res = NextResponse.redirect(location);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE_S,
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

