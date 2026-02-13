import "server-only";

import { Account, Client, Teams, Users } from "node-appwrite";
import { cookies } from "next/headers";

export type AppwriteServerConfig = {
  endpoint: string;
  projectId: string;
  apiKey: string;
  sessionCookieName: string;
  cookieDomain?: string;
};

export type AppwritePublicConfig = {
  endpoint: string;
  projectId: string;
  sessionCookieName: string;
  cookieDomain?: string;
};

function extractCookieValue(setCookieHeader: string, nameStartsWith: string): string | null {
  // A single Set-Cookie header value looks like:
  //   a_session_<projectId>=<value>; Path=/; HttpOnly; Secure; SameSite=None
  // We only need the cookie VALUE.
  const firstPart = setCookieHeader.split(";")[0] ?? "";
  const eqIndex = firstPart.indexOf("=");
  if (eqIndex === -1) return null;
  const name = firstPart.slice(0, eqIndex);
  const value = firstPart.slice(eqIndex + 1);
  if (!name.startsWith(nameStartsWith)) return null;
  return value || null;
}

export function getAppwritePublicConfig(): AppwritePublicConfig {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

  if (!endpoint) throw new Error("Missing env: NEXT_PUBLIC_APPWRITE_ENDPOINT");
  if (!projectId) throw new Error("Missing env: NEXT_PUBLIC_APPWRITE_PROJECT_ID");

  return {
    endpoint,
    projectId,
    sessionCookieName: process.env.APPWRITE_SESSION_COOKIE ?? "g3netic_session",
    cookieDomain: process.env.APP_COOKIE_DOMAIN
  };
}

export function getAppwriteServerConfig(): AppwriteServerConfig {
  const { endpoint, projectId, sessionCookieName, cookieDomain } = getAppwritePublicConfig();
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) throw new Error("Missing env: APPWRITE_API_KEY");

  return {
    endpoint,
    projectId,
    apiKey,
    sessionCookieName,
    cookieDomain
  };
}

export function createPublicAppwriteClient() {
  const cfg = getAppwritePublicConfig();
  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId);

  return {
    client,
    account: new Account(client)
  };
}

/**
 * Create an email/password session and return the **Appwrite session cookie value**.
 *
 * Why this exists:
 * - Appwrite's `/account/sessions/email` sets a session cookie via `Set-Cookie`.
 * - The response body does NOT include the cookie value.
 * - The Node SDK's `Client.setSession(...)` expects the same cookie value.
 */
export async function createEmailPasswordSessionToken(email: string, password: string): Promise<string> {
  const cfg = getAppwritePublicConfig();

  const res = await fetch(`${cfg.endpoint}/account/sessions/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Appwrite-Project": cfg.projectId,
      "X-Appwrite-Response-Format": "1.6.0"
    },
    body: JSON.stringify({ email, password })
  });

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const message = data?.message || `Login failed (${res.status})`;
    // Match node-appwrite's error shape enough for existing handlers.
    const err: any = new Error(message);
    err.code = res.status;
    err.type = data?.type;
    err.response = data;
    throw err;
  }

  // Node/undici supports getSetCookie(); Next route handlers run on Node runtime.
  const setCookies: string[] =
    (res.headers as any).getSetCookie?.() ??
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);

  // Appwrite uses a cookie that starts with "a_session".
  for (const sc of setCookies) {
    const value = extractCookieValue(sc, "a_session");
    if (value) return value;
  }

  throw new Error("Appwrite did not return a session cookie. Check Appwrite CORS/platform settings.");
}

export function createAdminAppwriteClient() {
  const cfg = getAppwriteServerConfig();
  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId).setKey(cfg.apiKey);

  return {
    client,
    account: new Account(client),
    teams: new Teams(client),
    users: new Users(client)
  };
}

export function createSessionAppwriteClient(sessionSecret?: string) {
  const cfg = getAppwritePublicConfig();

  const secret = sessionSecret ?? "";
  if (!secret) throw new Error("No session");

  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId).setSession(secret);

  // `setSession` expects the **Appwrite session cookie value** (a_session_* value).
  // We store that value in our custom HttpOnly cookie.

  return {
    client,
    account: new Account(client),
    teams: new Teams(client)
  };
}

export async function getLoggedInUser() {
  try {
    const cookieStore = await cookies();
    const cfg = getAppwriteServerConfig();
    const secret = cookieStore.get(cfg.sessionCookieName)?.value;
    if (!secret) return null;

    const { account } = createSessionAppwriteClient(secret);
    return await account.get();
  } catch {
    return null;
  }
}

export async function listCurrentUserTeams() {
  const cookieStore = await cookies();
  const cfg = getAppwriteServerConfig();
  const secret = cookieStore.get(cfg.sessionCookieName)?.value;
  if (!secret) throw new Error("No session");

  const { teams } = createSessionAppwriteClient(secret);
  const res = await teams.list();
  return res.teams;
}
