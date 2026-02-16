import { describe, expect, it } from "bun:test";

import {
  buildDiscordAuthorizeUrl,
  parseDiscordOAuthResultCookie,
  parseDiscordOAuthStateCookie,
  sanitizeRedirectPath,
} from "../lib/discordOAuth";

describe("discordOAuth", () => {
  it("normalizes unsafe redirect paths to dashboard", () => {
    expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//evil.example")).toBe("/dashboard");
  });

  it("builds Discord authorize URL with expected parameters", () => {
    const url = buildDiscordAuthorizeUrl({
      clientId: "123",
      redirectUri: "https://app.example.com/api/auth/discord/callback",
      state: "state_abc",
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://discord.com");
    expect(parsed.pathname).toBe("/oauth2/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("123");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("identify");
    expect(parsed.searchParams.get("state")).toBe("state_abc");
  });

  it("parses valid state cookie payload", () => {
    const parsed = parseDiscordOAuthStateCookie(
      JSON.stringify({
        state: "state_abc",
        redirectPath: "/dashboard",
        issuedAt: 1771200000000,
      }),
    );

    expect(parsed).toEqual({
      state: "state_abc",
      redirectPath: "/dashboard",
      issuedAt: 1771200000000,
    });
  });

  it("rejects malformed result cookie payload", () => {
    expect(parseDiscordOAuthResultCookie("{")).toBeNull();
    expect(
      parseDiscordOAuthResultCookie(
        JSON.stringify({
          discordUserId: "",
          username: "abc",
          receivedAt: 1771200000000,
        }),
      ),
    ).toBeNull();
  });
});
