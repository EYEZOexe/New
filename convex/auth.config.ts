import type { AuthConfig } from "convex/server";

const siteUrl = process.env.CONVEX_SITE_URL;
if (!siteUrl) {
  throw new Error("Missing env: CONVEX_SITE_URL");
}

// Convex Auth validates and issues its own JWTs. These providers describe the
// issuer + audience for those tokens.
export default {
  providers: [
    {
      domain: siteUrl,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

