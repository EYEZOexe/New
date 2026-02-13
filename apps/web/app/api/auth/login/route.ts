import { NextResponse } from "next/server";

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

  const cfg = getAppwritePublicConfig();
  const { account } = createPublicAppwriteClient();

  // Create session (server-side, returns secret)
  const session = await account.createEmailPasswordSession(body.email, body.password);

  // In Route Handlers, set cookies on the response (not via `cookies()`)
  // so the Set-Cookie header is reliably included.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cfg.sessionCookieName, session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(cfg.cookieDomain ? { domain: cfg.cookieDomain } : {})
  });

  return res;
}
