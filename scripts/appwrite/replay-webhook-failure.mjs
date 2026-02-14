/**
 * Replay a stored webhook failure through the public Worker URL.
 *
 * Usage:
 *   node scripts/appwrite/replay-webhook-failure.mjs --env-file .env.appwrite --failure-id <DOC_ID>
 */

import crypto from "node:crypto";
import fs from "node:fs";

function parseArgs(argv) {
  const args = { envFile: undefined, failureId: undefined, url: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env-file") {
      args.envFile = argv[i + 1];
      i++;
      continue;
    }
    if (a === "--failure-id") {
      args.failureId = argv[i + 1];
      i++;
      continue;
    }
    if (a === "--url") {
      args.url = argv[i + 1];
      i++;
      continue;
    }
  }
  return args;
}

function loadEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^"(.*)"$/, "$1");
    value = value.replace(/^'(.*)'$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function appwriteJson({ endpoint, projectId, apiKey, method, path }) {
  const url = `${endpoint.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey
    }
  });
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;
  if (res.ok) return data;

  const err = new Error((data && data.message) || `Appwrite error ${res.status} on ${method} ${path}`);
  err.status = res.status;
  err.response = data;
  throw err;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.envFile) loadEnvFile(args.envFile);

  const failureId = args.failureId || requiredEnv("WEBHOOK_FAILURE_ID");

  const endpoint = requiredEnv("APPWRITE_ENDPOINT").replace(/\/$/, "");
  const projectId = requiredEnv("APPWRITE_PROJECT_ID");
  const apiKey = requiredEnv("APPWRITE_API_KEY");

  const sellappSecret = requiredEnv("SELLAPP_WEBHOOK_SECRET");
  const databaseId = process.env.APPWRITE_DATABASE_ID || "crypto";
  const failuresCollectionId =
    process.env.APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID || "webhook_failures";

  const webhookUrl = args.url || process.env.SELLAPP_WEBHOOK_URL || "https://webhooks.g3netic.com/sell/webhook";

  const doc = await appwriteJson({
    endpoint,
    projectId,
    apiKey,
    method: "GET",
    path: `/databases/${databaseId}/collections/${failuresCollectionId}/documents/${failureId}`
  });

  const bodyText = doc?.bodyText;
  if (typeof bodyText !== "string" || bodyText.length === 0) {
    throw new Error("Failure document missing bodyText");
  }

  const signature = hmacSha256Hex(sellappSecret, bodyText);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      signature
    },
    body: bodyText
  });

  const responseText = await res.text().catch(() => "");
  console.log(`replay -> ${res.status}`);
  if (responseText) console.log(responseText.slice(0, 800));

  if (!res.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.response || err);
  process.exit(1);
});

