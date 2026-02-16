import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  DISCORD_OAUTH_RESULT_COOKIE,
  DISCORD_OAUTH_RESULT_TTL_MS,
  DISCORD_OAUTH_STATE_COOKIE,
  DISCORD_OAUTH_STATE_TTL_MS,
  encodeDiscordOAuthResultCookie,
  isFreshDiscordOAuthTimestamp,
  parseDiscordOAuthProfile,
  parseDiscordOAuthStateCookie,
} from "@/lib/discordOAuth";
import {
  resolveAppOrigin,
  resolveDiscordCallbackUrl,
  shouldUseSecureCookies,
} from "@/lib/discordOAuthHttp";

function redirectToDashboard(
  request: Request,
  redirectPath: string,
  args?: { discordError?: string; discordLink?: string },
): NextResponse {
  const url = new URL(redirectPath, resolveAppOrigin(request));
  if (args?.discordError) {
    url.searchParams.set("discord_error", args.discordError);
  }
  if (args?.discordLink) {
    url.searchParams.set("discord_link", args.discordLink);
  }
  return NextResponse.redirect(url);
}

function readAccessToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const token = (payload as Record<string, unknown>).access_token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const url = new URL(request.url);

  const parsedState = parseDiscordOAuthStateCookie(
    cookieStore.get(DISCORD_OAUTH_STATE_COOKIE)?.value,
  );
  const redirectPath = parsedState?.redirectPath ?? "/dashboard";

  const state = url.searchParams.get("state")?.trim() ?? "";
  const code = url.searchParams.get("code")?.trim() ?? "";

  if (!parsedState) {
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "state_missing",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const now = Date.now();
  if (
    !isFreshDiscordOAuthTimestamp({
      timestamp: parsedState.issuedAt,
      now,
      ttlMs: DISCORD_OAUTH_STATE_TTL_MS,
    })
  ) {
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "state_expired",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  if (!state || state !== parsedState.state) {
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "state_mismatch",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  if (!code) {
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "missing_code",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const clientId = process.env.DISCORD_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) {
    console.error("[discord-oauth] callback missing DISCORD_CLIENT_ID/SECRET");
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "provider_not_configured",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const callbackUrl = resolveDiscordCallbackUrl(request);
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
  });

  const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    console.error(
      `[discord-oauth] token exchange failed status=${tokenResponse.status}`,
    );
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "token_exchange_failed",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as unknown;
  const accessToken = readAccessToken(tokenPayload);
  if (!accessToken) {
    console.error("[discord-oauth] token exchange response missing access token");
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "token_invalid",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const profileResponse = await fetch("https://discord.com/api/v10/users/@me", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    console.error(
      `[discord-oauth] profile fetch failed status=${profileResponse.status}`,
    );
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "profile_fetch_failed",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const profilePayload = (await profileResponse.json().catch(() => null)) as unknown;
  const profile = parseDiscordOAuthProfile(profilePayload);
  if (!profile) {
    console.error("[discord-oauth] profile payload missing required id field");
    const response = redirectToDashboard(request, redirectPath, {
      discordError: "profile_invalid",
    });
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const response = redirectToDashboard(request, redirectPath, {
    discordLink: "complete",
  });
  response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
  response.cookies.set({
    name: DISCORD_OAUTH_RESULT_COOKIE,
    value: encodeDiscordOAuthResultCookie({
      discordUserId: profile.discordUserId,
      username: profile.username,
      receivedAt: now,
    }),
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DISCORD_OAUTH_RESULT_TTL_MS / 1000),
  });

  console.info(
    `[discord-oauth] callback success discord_user=${profile.discordUserId}`,
  );

  return response;
}

