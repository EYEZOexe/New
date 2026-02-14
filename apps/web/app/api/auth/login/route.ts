import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { createEmailPasswordSessionToken, getAppwritePublicConfig } from "../../../../lib/appwrite-server";

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

    // Create session token (Appwrite session cookie value)
    const sessionToken = await createEmailPasswordSessionToken(body.email, body.password);

    const h = await headers();
    const hostHeader = h.get("host") ?? "";
    const host = hostHeader.startsWith("[") ? hostHeader : hostHeader.split(":")[0];
    const cookieDomain =
      cfg.cookieDomain && host.endsWith(cfg.cookieDomain.replace(/^\./, ""))
        ? cfg.cookieDomain
        : undefined;

    // In Route Handlers, set cookies on the response (not via `cookies()`)
    // so the Set-Cookie header is reliably included.
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cfg.sessionCookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(cookieDomain ? { domain: cookieDomain } : {})
    });

    return res;
  } catch (err: any) {
    // Our REST wrapper throws an Error with `code` similar to Appwrite SDK errors.
    const status = typeof err?.code === "number" ? err.code : 500;
    const message =
      status === 429
        ? "Too many login attempts. Please wait a bit and try again."
        : err?.message || "Login failed";

    return NextResponse.json({ error: message }, { status });
  }
}
