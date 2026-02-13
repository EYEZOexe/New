import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { createPublicAppwriteClient, createSessionAppwriteClient, getAppwritePublicConfig } from "../../../../lib/appwrite-server";

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

    // Different Appwrite versions/environments may require the session *secret* or session `$id`
    // for `X-Appwrite-Session`. Verify by calling `account.get()`.
    const candidates = [
      typeof (session as any).secret === "string" ? (session as any).secret : undefined,
      session.$id
    ].filter(Boolean) as string[];

    let sessionToken: string | null = null;
    for (const token of candidates) {
      try {
        const { account: authedAccount } = createSessionAppwriteClient(token);
        await authedAccount.get();
        sessionToken = token;
        break;
      } catch {
        // try next candidate
      }
    }

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Login succeeded but session could not be validated. Check Appwrite session settings." },
        { status: 500 }
      );
    }

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
    // node-appwrite throws AppwriteException with `code` and `message`
    const status = typeof err?.code === "number" ? err.code : 500;
    const message =
      status === 429
        ? "Too many login attempts. Please wait a bit and try again."
        : err?.message || "Login failed";

    return NextResponse.json({ error: message }, { status });
  }
}
