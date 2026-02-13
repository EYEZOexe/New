/** @type {import('next').NextConfig} */
const nextConfig = {};

// Standalone output is great for Docker deployments, but on some Windows setups
// it can fail due to symlink permissions.
//
// In Docker/Coolify builds set: NEXT_OUTPUT=standalone
if (process.env.NEXT_OUTPUT === "standalone") {
  nextConfig.output = "standalone";
}

module.exports = nextConfig;
