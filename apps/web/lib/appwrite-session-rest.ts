import { extractCookieValue } from "./appwrite-cookies";

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildSessionCookieHeader(projectId: string, sessionToken: string) {
  // Appwrite expects cookies named:
  //   a_session_<projectId>
  //   a_session_<projectId>_legacy
  // We store ONLY the cookie VALUE in our own cookie, so we reconstruct both.
  return `a_session_${projectId}=${sessionToken}; a_session_${projectId}_legacy=${sessionToken}`;
}

function joinPath(endpoint: string, path: string) {
  return `${endpoint.replace(/\/$/, "")}${path}`;
}

type SessionClientParams = {
  endpoint: string;
  projectId: string;
  sessionToken: string;
  fetchImpl?: typeof fetch;
};

export function createAppwriteSessionRestClient(params: SessionClientParams) {
  const fetchImpl = params.fetchImpl ?? fetch;

  async function requestJson<T>(
    path: string,
    init: RequestInit & { jsonBody?: unknown } = {}
  ): Promise<T> {
    const res = await fetchImpl(joinPath(params.endpoint, path), {
      ...init,
      headers: {
        ...(init.jsonBody !== undefined ? { "content-type": "application/json" } : {}),
        "X-Appwrite-Project": params.projectId,
        Cookie: buildSessionCookieHeader(params.projectId, params.sessionToken),
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

    const message =
      (data as any)?.message || `Appwrite error ${res.status} on ${init.method || "GET"} ${path}`;
    const err: any = new Error(message);
    err.code = res.status;
    err.type = (data as any)?.type;
    err.response = data;
    throw err;
  }

  async function requestRedirectLocation(path: string): Promise<string> {
    const timeoutMsRaw = process.env.APPWRITE_OAUTH_START_TIMEOUT_MS;
    const timeoutMs =
      typeof timeoutMsRaw === "string" && /^\d+$/.test(timeoutMsRaw)
        ? Number(timeoutMsRaw)
        : 15_000;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    let res: Response;
    try {
      res = await fetchImpl(joinPath(params.endpoint, path), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "X-Appwrite-Project": params.projectId,
          Cookie: buildSessionCookieHeader(params.projectId, params.sessionToken)
        }
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        const e: any = new Error(`Appwrite OAuth start timed out after ${timeoutMs}ms`);
        e.code = "timeout";
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    const location = (res.headers as any)?.get?.("location") ?? (res.headers as any)?.get?.("Location");
    if (typeof location === "string" && location.length) return location;

    // Some Appwrite versions may respond 200 with JSON instead of a redirect.
    const text = await res.text().catch(() => "");
    const data = text ? safeJsonParse(text) : null;

    // If this wasn't a redirect response, and Appwrite says it's an error, surface that error.
    const isRedirectStatus = res.status >= 300 && res.status < 400;
    if (!isRedirectStatus && !res.ok) {
      const message = (data as any)?.message || `Appwrite error ${res.status} on GET ${path}`;
      const err: any = new Error(message);
      err.code = res.status;
      err.type = (data as any)?.type;
      err.response = data;
      throw err;
    }

    const url = (data as any)?.url ?? (data as any)?.uri ?? (data as any)?.location;
    if (typeof url === "string" && url.length) return url;

    const err: any = new Error("Appwrite did not return a redirect Location header for OAuth start");
    err.code = res.status;
    err.response = data;
    throw err;
  }

  return {
    async startDiscordOAuthToken(opts: { success: string; failure: string }) {
      const qs = new URLSearchParams({ success: opts.success, failure: opts.failure });

      // Appwrite 1.7.x uses the session OAuth endpoint (redirect-based).
      // Newer versions also support token endpoints. We try session first, then token as fallback.
      try {
        return await requestRedirectLocation(`/account/sessions/oauth2/discord?${qs.toString()}`);
      } catch {
        return await requestRedirectLocation(`/account/tokens/oauth2/discord?${qs.toString()}`);
      }
    },

    async listIdentities() {
      const res = await requestJson<{ identities: any[] }>(`/account/identities`, { method: "GET" });
      return res.identities;
    },

    async deleteIdentity(identityId: string) {
      await requestJson<any>(`/account/identities/${encodeURIComponent(identityId)}`, { method: "DELETE" });
    }
  };
}

type TokenSessionParams = {
  endpoint: string;
  projectId: string;
  userId: string;
  secret: string;
  fetchImpl?: typeof fetch;
};

export async function createTokenSessionCookieValue(params: TokenSessionParams): Promise<string> {
  const fetchImpl = params.fetchImpl ?? fetch;

  const res = await fetchImpl(joinPath(params.endpoint, `/account/sessions/token`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Appwrite-Project": params.projectId,
      // Keep response format stable for cookie/session behavior across versions.
      "X-Appwrite-Response-Format": "1.6.0"
    },
    body: JSON.stringify({ userId: params.userId, secret: params.secret })
  });

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const message = data?.message || `Token session creation failed (${res.status})`;
    const err: any = new Error(message);
    err.code = res.status;
    err.type = data?.type;
    err.response = data;
    throw err;
  }

  const setCookies: string[] =
    (res.headers as any).getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);

  for (const sc of setCookies) {
    const value = extractCookieValue(sc, "a_session");
    if (value) return value;
  }

  throw new Error("Appwrite did not return a session cookie for token session.");
}
