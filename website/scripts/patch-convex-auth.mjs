import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "node_modules",
  "@convex-dev",
  "auth",
  "dist",
  "server",
  "implementation",
  "tokens.js",
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  fail(`Missing file: ${targetPath}`);
}

const original = fs.readFileSync(targetPath, "utf8");

// Already patched.
if (original.includes('typ: "JWT"') && original.includes("JWKS")) {
  process.exit(0);
}

let next = original;

// Insert kid extraction (from JWKS env) after private key import.
if (!next.includes("const jwks = JSON.parse(requireEnv(\"JWKS\"))")) {
  next = next.replace(
    'const privateKey = await importPKCS8(requireEnv("JWT_PRIVATE_KEY"), "RS256");',
    [
      'const privateKey = await importPKCS8(requireEnv("JWT_PRIVATE_KEY"), "RS256");',
      '    const jwks = JSON.parse(requireEnv("JWKS"));',
      '    const kid = jwks?.keys?.[0]?.kid;',
    ].join("\n"),
  );
}

// Add typ/kid to protected header to satisfy Convex JWT validation.
next = next.replace(
  '.setProtectedHeader({ alg: "RS256" })',
  '.setProtectedHeader({ alg: "RS256", typ: "JWT", ...(kid ? { kid } : {}) })',
);

if (next === original) {
  fail(
    "Failed to patch @convex-dev/auth tokens.js (unexpected file contents).",
  );
}

fs.writeFileSync(targetPath, next, "utf8");

