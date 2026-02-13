import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { createPublicAppwriteClient, getAppwritePublicConfig } from "../../../../lib/appwrite-server";

type LoginBody = {
  email: string;
  password: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  try {
    const cfg = getAppwritePublicConfig();
    const { account } = createPublicAppwriteClient();

    // Create session
    const session = await account.createEmailPasswordSession(body.email, body.password);

    const h = await headers();
    const host = h.get("host") ?? "";
    const cookieDomain =
      cfg.cookieDomain && host.endsWith(cfg.cookieDomain.replace(/^\./, ""))
        ? cfg.cookieDomain
        : undefined;

  // In Route Handlers, set cookies on the response (not via `cookies()`)
  // so the Set-Cookie header is reliably included.
    const res = NextResponse.json({ ok: true });
    // `Client.setSession(...)` expects the session ID (the `$id`), not the secret.
    res.cookies.set(cfg.sessionCookieName, session.$id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(cookieDomain ? { domain: cookieDomain } : {})
    });

    return res;
  } catch (err: any) {
    // node-appwrite throws AppwriteException with `code` and `message`
    const status = typeof err?.code === "number" ? err.code : 500;
    const message =
      status === 429
        ? "Too many login attempts. Please wait a bit and try again."
        : err?.message || "Login failed";

    return NextResponse.json({ error: message }, { status });
  }
}
