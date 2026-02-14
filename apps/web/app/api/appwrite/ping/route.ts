import { NextResponse } from "next/server";

import { getAuthContext } from "../../../../lib/auth";
import { getAppwritePublicConfig } from "../../../../lib/appwrite-server";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getAppwritePublicConfig();
  const url = `${cfg.endpoint.replace(/\/$/, "")}/ping`;

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        // Keep response format stable across Appwrite versions.
        "X-Appwrite-Response-Format": "1.6.0",
        "X-Appwrite-Project": cfg.projectId
      },
      cache: "no-store"
    });

    const text = await res.text().catch(() => "");
    const latencyMs = Date.now() - started;

    return NextResponse.json(
      {
        ok: res.ok,
        status: res.status,
        latencyMs,
        endpoint: cfg.endpoint,
        // response is safe here (it should be "Pong" / JSON), but keep it capped.
        responseSnippet: text ? text.slice(0, 300) : ""
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (err: any) {
    const latencyMs = Date.now() - started;
    const message = err?.name === "AbortError" ? "Ping timed out" : err?.message ?? "Ping failed";
    return NextResponse.json(
      { ok: false, status: 0, latencyMs, endpoint: cfg.endpoint, error: message },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } finally {
    clearTimeout(timeout);
  }
}
