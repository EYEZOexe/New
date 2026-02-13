import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getAppwritePublicConfig } from "../../../../lib/appwrite-server";

// Debug endpoint to help diagnose cookie issues in environments.
// Do not expose in production long-term.
export async function GET() {
  const cfg = getAppwritePublicConfig();
  const cookieStore = await cookies();
  const h = await headers();

  return NextResponse.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      APPWRITE_SESSION_COOKIE: process.env.APPWRITE_SESSION_COOKIE,
      APP_COOKIE_DOMAIN: process.env.APP_COOKIE_DOMAIN
    },
    request: {
      host: h.get("host"),
      forwardedProto: h.get("x-forwarded-proto"),
      cookieHeader: h.get("cookie")
    },
    cookie: {
      name: cfg.sessionCookieName,
      valuePresent: Boolean(cookieStore.get(cfg.sessionCookieName)?.value)
    }
  });
}