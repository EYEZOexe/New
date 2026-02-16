import { NextResponse } from "next/server";

import {
  buildDiscordAuthorizeUrl,
  DISCORD_OAUTH_RESULT_COOKIE,
  DISCORD_OAUTH_STATE_COOKIE,
  DISCORD_OAUTH_STATE_TTL_MS,
  encodeDiscordOAuthStateCookie,
  generateDiscordOAuthState,
  sanitizeRedirectPath,
} from "@/lib/discordOAuth";
import {
  jsonApiError,
  resolveDiscordCallbackUrl,
  shouldUseSecureCookies,
} from "@/lib/discordOAuthHttp";

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  if (!clientId) {
    return jsonApiError({
      status: 503,
      errorCode: "not_configured",
      message: "DISCORD_CLIENT_ID is not configured",
    });
  }

  const url = new URL(request.url);
  const redirectPath = sanitizeRedirectPath(url.searchParams.get("redirect"));
  const state = generateDiscordOAuthState();
  const issuedAt = Date.now();
  const callbackUrl = resolveDiscordCallbackUrl(request);
  const authorizeUrl = buildDiscordAuthorizeUrl({
    clientId,
    redirectUri: callbackUrl,
    state,
  });

  console.info(
    `[discord-oauth] start redirect=${redirectPath} callback=${callbackUrl}`,
  );

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set({
    name: DISCORD_OAUTH_STATE_COOKIE,
    value: encodeDiscordOAuthStateCookie({
      state,
      redirectPath,
      issuedAt,
    }),
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DISCORD_OAUTH_STATE_TTL_MS / 1000),
  });
  response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
  return response;
}

