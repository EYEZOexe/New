import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { ID } from "node-appwrite";
import { createAdminAppwriteClient, createPublicAppwriteClient, getAppwritePublicConfig } from "../../../../lib/appwrite-server";

type SignupBody = {
  email: string;
  password: string;
  name?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SignupBody | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const cfg = getAppwritePublicConfig();

  const h = await headers();
  const host = h.get("host") ?? "";
  const cookieDomain =
    cfg.cookieDomain && host.endsWith(cfg.cookieDomain.replace(/^\./, ""))
      ? cfg.cookieDomain
      : undefined;

  // Create user (admin scope)
  const { users } = createAdminAppwriteClient();
  // Important: don't pass empty string for `phone` (Appwrite validates phone format).
  await users.create(ID.unique(), body.email, undefined, body.password, body.name);

  // Create session (public scope)
  const { account } = createPublicAppwriteClient();
  const session = await account.createEmailPasswordSession(body.email, body.password);

  // In Route Handlers, set cookies on the response (not via `cookies()`).
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cfg.sessionCookieName, session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {})
  });

  return res;
}
