import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { ID } from "node-appwrite";
import { createAdminAppwriteClient, createEmailPasswordSessionToken, getAppwritePublicConfig } from "../../../../lib/appwrite-server";

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

  try {
    const cfg = getAppwritePublicConfig();

    const h = await headers();
    const hostHeader = h.get("host") ?? "";
    const host = hostHeader.startsWith("[") ? hostHeader : hostHeader.split(":")[0];
    const cookieDomain =
      cfg.cookieDomain && host.endsWith(cfg.cookieDomain.replace(/^\./, ""))
        ? cfg.cookieDomain
        : undefined;

    // Create user (admin scope)
    const { users } = createAdminAppwriteClient();
    // Important: don't pass empty string for `phone` (Appwrite validates phone format).
    await users.create(ID.unique(), body.email, undefined, body.password, body.name);

    // Create session token (Appwrite session cookie value)
    const sessionToken = await createEmailPasswordSessionToken(body.email, body.password);

    // In Route Handlers, set cookies on the response (not via `cookies()`).
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
    const status = typeof err?.code === "number" ? err.code : 500;
    const message =
      status === 429
        ? "Too many signup attempts. Please wait a bit and try again."
        : status === 409
          ? "An account with this email already exists."
          : err?.message || "Signup failed";

    return NextResponse.json({ error: message }, { status });
  }
}
