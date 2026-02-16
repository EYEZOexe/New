import { NextResponse } from "next/server";

export function jsonApiError(args: {
  status: number;
  errorCode: string;
  message: string;
}): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error_code: args.errorCode,
      message: args.message,
    },
    { status: args.status },
  );
}

export function resolveAppOrigin(request: Request): string {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envOrigin) {
    return envOrigin.replace(/\/$/, "");
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  if (forwardedHost) {
    const protocol = forwardedProto === "http" ? "http" : "https";
    return `${protocol}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export function resolveDiscordCallbackUrl(request: Request): string {
  const configured = process.env.DISCORD_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  return `${resolveAppOrigin(request)}/api/auth/discord/callback`;
}

export function shouldUseSecureCookies(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return new URL(request.url).protocol === "https:";
}

