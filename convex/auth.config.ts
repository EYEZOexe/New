const rawSiteUrl = process.env.CONVEX_SITE_URL ?? process.env.CONVEX_SITE_ORIGIN;

export default {
  providers: [
    {
      domain: rawSiteUrl?.trim().replace(/\/$/, ""),
      applicationID: "convex",
    },
  ],
};
