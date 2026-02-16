import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  DISCORD_OAUTH_RESULT_COOKIE,
  DISCORD_OAUTH_RESULT_TTL_MS,
  isFreshDiscordOAuthTimestamp,
  parseDiscordOAuthResultCookie,
} from "@/lib/discordOAuth";
import { jsonApiError } from "@/lib/discordOAuthHttp";

export async function POST() {
  const cookieStore = await cookies();
  const parsed = parseDiscordOAuthResultCookie(
    cookieStore.get(DISCORD_OAUTH_RESULT_COOKIE)?.value,
  );

  if (!parsed) {
    return jsonApiError({
      status: 400,
      errorCode: "oauth_result_missing",
      message: "No Discord OAuth result available",
    });
  }

  if (
    !isFreshDiscordOAuthTimestamp({
      timestamp: parsed.receivedAt,
      now: Date.now(),
      ttlMs: DISCORD_OAUTH_RESULT_TTL_MS,
    })
  ) {
    const response = jsonApiError({
      status: 400,
      errorCode: "oauth_result_expired",
      message: "Discord OAuth result expired",
    });
    response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
    return response;
  }

  const response = NextResponse.json({
    ok: true,
    discord_user_id: parsed.discordUserId,
    username: parsed.username,
    linked_at: parsed.receivedAt,
  });
  response.cookies.delete(DISCORD_OAUTH_RESULT_COOKIE);
  return response;
}

