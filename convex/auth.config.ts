function normalizePublicAuthDomain(rawValue: string | undefined): string | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/$/, "");
}

export default {
  providers: [
    {
      domain: normalizePublicAuthDomain(process.env.CONVEX_SITE_URL),
      applicationID: "convex",
    },
  ],
};
