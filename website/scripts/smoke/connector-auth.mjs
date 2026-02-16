import { createHash } from "node:crypto";

const token = process.env.CONNECTOR_TOKEN;
if (!token) {
  throw new Error("Missing CONNECTOR_TOKEN");
}

const hash = createHash("sha256").update(token).digest("hex");
console.log(JSON.stringify({ tokenLength: token.length, tokenHash: hash }));

