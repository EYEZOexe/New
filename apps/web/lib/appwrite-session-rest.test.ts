import test from "node:test";
import assert from "node:assert/strict";

import { createAppwriteSessionRestClient, createTokenSessionCookieValue } from "./appwrite-session-rest";

test("startDiscordOAuthToken uses session cookies and returns redirect location", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const fetchImpl: typeof fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return {
      ok: false,
      status: 302,
      headers: {
        get: (name: string) => (name.toLowerCase() === "location" ? "https://discord.example/authorize" : null)
      },
      text: async () => ""
    } as any;
  }) as any;

  const client = createAppwriteSessionRestClient({
    endpoint: "https://appwrite.example/v1",
    projectId: "proj",
    sessionToken: "SESSION",
    fetchImpl
  });

  const location = await client.startDiscordOAuthToken({
    success: "https://crypto.example/api/auth/discord/complete",
    failure: "https://crypto.example/dashboard?err=1"
  });

  assert.equal(location, "https://discord.example/authorize");
  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.init.redirect === "manual");

  const cookieHeader = (calls[0]!.init.headers as any)?.Cookie;
  assert.ok(String(cookieHeader).includes("a_session_proj=SESSION"));
  assert.ok(String(cookieHeader).includes("a_session_proj_legacy=SESSION"));

  // Should hit the session oauth endpoint first (Appwrite 1.7.x compatible).
  assert.ok(calls[0]!.url.includes("/account/sessions/oauth2/discord"));
});

test("createTokenSessionCookieValue extracts a_session cookie from Set-Cookie headers", async () => {
  const fetchImpl: typeof fetch = (async () => {
    return {
      ok: true,
      status: 201,
      json: async () => ({ $id: "session" }),
      headers: {
        getSetCookie: () => ["a_session_proj=NEWTOKEN; Path=/; HttpOnly"]
      }
    } as any;
  }) as any;

  const token = await createTokenSessionCookieValue({
    endpoint: "https://appwrite.example/v1",
    projectId: "proj",
    userId: "u1",
    secret: "s1",
    fetchImpl
  });

  assert.equal(token, "NEWTOKEN");
});
