import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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

  // Create user (admin scope)
  const { users } = createAdminAppwriteClient();
  await users.create(ID.unique(), body.email, "", body.password, body.name);

  // Create session (public scope)
  const { account } = createPublicAppwriteClient();
  const session = await account.createEmailPasswordSession(body.email, body.password);

  const cookieStore = await cookies();
  cookieStore.set(cfg.sessionCookieName, session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(cfg.cookieDomain ? { domain: cfg.cookieDomain } : {})
  });

  return NextResponse.json({ ok: true });
}
