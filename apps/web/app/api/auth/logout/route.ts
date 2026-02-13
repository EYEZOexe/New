import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSessionAppwriteClient, getAppwritePublicConfig } from "../../../../lib/appwrite-server";

export async function POST() {
  const cfg = getAppwritePublicConfig();
  const cookieStore = await cookies();
  const sessionSecret = cookieStore.get(cfg.sessionCookieName)?.value;

  // Clear cookie regardless (idempotent)
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(cfg.sessionCookieName);

  if (sessionSecret) {
    try {
      const { account } = createSessionAppwriteClient(sessionSecret);
      await account.deleteSession("current");
    } catch {
      // ignore; cookie already deleted
    }
  }

  return res;
}
