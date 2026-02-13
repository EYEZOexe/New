/** @type {import('next').NextConfig} */
const nextConfig = {};

// In Docker/Coolify builds set: NEXT_OUTPUT=standalone
if (process.env.NEXT_OUTPUT === "standalone") {
  nextConfig.output = "standalone";
}

module.exports = nextConfig;
