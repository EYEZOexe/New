function normalizePublicAuthDomain(rawValue: string | undefined): string | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) return undefined;

  const url = new URL(trimmed);
  const isLocalHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  // When Convex is published through Cloudflare Tunnel, the origin service can
  // stay on plain HTTP internally, but the public issuer must remain HTTPS.
  if (url.protocol === "http:" && !isLocalHost) {
    url.protocol = "https:";
  }

  return url.toString().replace(/\/$/, "");
}

export default {
  providers: [
    {
      domain: normalizePublicAuthDomain(process.env.CONVEX_SITE_URL),
      applicationID: "convex",
    },
  ],
};
