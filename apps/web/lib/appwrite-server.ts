import "server-only";

import { cookies } from "next/headers";
import crypto from "node:crypto";

import { extractCookieValue } from "./appwrite-cookies";

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

type AppwriteRestError = Error & {
  code?: number;
  type?: string;
  response?: unknown;
};

function makeError(message: string, extras?: Partial<AppwriteRestError>): AppwriteRestError {
  const err: AppwriteRestError = new Error(message);
  Object.assign(err, extras);
  return err;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function appwriteFetchJson<T>(
  cfg: { endpoint: string; projectId: string; apiKey?: string; sessionToken?: string },
  path: string,
  init: RequestInit & { jsonBody?: unknown } = {}
): Promise<T> {
  const url = `${cfg.endpoint.replace(/\/$/, "")}${path}`;

  // When using sessions, Appwrite expects cookies named:
  //   a_session_<projectId>
  //   a_session_<projectId>_legacy
  // We store ONLY the cookie VALUE in our own cookie, so we reconstruct both.
  const sessionCookieHeader = cfg.sessionToken
    ? `a_session_${cfg.projectId}=${cfg.sessionToken}; a_session_${cfg.projectId}_legacy=${cfg.sessionToken}`
    : undefined;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.jsonBody !== undefined ? { "content-type": "application/json" } : {}),
      "X-Appwrite-Project": cfg.projectId,
      ...(cfg.apiKey ? { "X-Appwrite-Key": cfg.apiKey } : {}),
      ...(sessionCookieHeader ? { Cookie: sessionCookieHeader } : {}),
      ...(init.headers ?? {})
    },
    body:
      init.jsonBody === undefined
        ? init.body
        : typeof init.jsonBody === "string"
          ? (init.jsonBody as string)
          : JSON.stringify(init.jsonBody)
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (res.ok) return data as T;

  // Match Appwrite SDK's error shape enough for existing handlers.
  throw makeError(data?.message || `Appwrite error ${res.status} on ${init.method || "GET"} ${path}`, {
    code: res.status,
    type: data?.type,
    response: data
  });
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

export function appwriteUniqueId(): string {
  // Appwrite ID constraints: max length 36; UUID is 36.
  return crypto.randomUUID();
}

/**
 * Create an email/password session and return the **Appwrite session cookie value**.
 *
 * Why this exists:
 * - Appwrite's `/account/sessions/email` sets a session cookie via `Set-Cookie`.
 * - The response body does NOT include the cookie value.
 * - We store the cookie value in our own HttpOnly cookie for SSR/session usage.
 */
export async function createEmailPasswordSessionToken(email: string, password: string): Promise<string> {
  const cfg = getAppwritePublicConfig();

  const res = await fetch(`${cfg.endpoint.replace(/\/$/, "")}/account/sessions/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Appwrite-Project": cfg.projectId,
      // Keep response format stable for cookie/session behavior across versions.
      "X-Appwrite-Response-Format": "1.6.0"
    },
    body: JSON.stringify({ email, password })
  });

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const message = data?.message || `Login failed (${res.status})`;
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

  return {
    async createUser(params: { userId: string; email: string; password: string; name?: string }) {
      await appwriteFetchJson(cfg, `/users`, {
        method: "POST",
        jsonBody: {
          userId: params.userId,
          email: params.email,
          password: params.password,
          name: params.name
        }
      });
    },
    async listUserMemberships(userId: string) {
      const res = await appwriteFetchJson<{ memberships: Array<{ teamId: string; confirm: boolean }> }>(
        cfg,
        `/users/${userId}/memberships`,
        { method: "GET" }
      );
      return res.memberships;
    }
  };
}

export function createSessionAppwriteClient(sessionSecret?: string) {
  const publicCfg = getAppwritePublicConfig();

  const secret = sessionSecret ?? "";
  if (!secret) throw new Error("No session");

  const cfg = {
    endpoint: publicCfg.endpoint,
    projectId: publicCfg.projectId,
    sessionToken: secret
  };

  return {
    async getAccount() {
      return await appwriteFetchJson<any>(cfg, `/account`, { method: "GET" });
    },
    async deleteCurrentSession() {
      // Returns 204 on success (no body). Our JSON helper treats empty body as null.
      await appwriteFetchJson<any>(cfg, `/account/sessions/current`, { method: "DELETE" });
    },
    async listTeams() {
      const res = await appwriteFetchJson<{ teams: any[] }>(cfg, `/teams`, { method: "GET" });
      return res.teams;
    }
  };
}

export async function getLoggedInUser() {
  try {
    const cookieStore = await cookies();
    const cfg = getAppwriteServerConfig();
    const secret = cookieStore.get(cfg.sessionCookieName)?.value;
    if (!secret) return null;

    const session = createSessionAppwriteClient(secret);
    return await session.getAccount();
  } catch {
    return null;
  }
}

export async function listCurrentUserTeams() {
  const cookieStore = await cookies();
  const cfg = getAppwriteServerConfig();
  const secret = cookieStore.get(cfg.sessionCookieName)?.value;
  if (!secret) throw new Error("No session");

  const session = createSessionAppwriteClient(secret);
  return await session.listTeams();
}

