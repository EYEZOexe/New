/**
 * Upsert a subscription document for a user (looked up by email).
 *
 * Usage:
 *   node scripts/appwrite/upsert-subscription.mjs --email test@gmail.com --status active --plan "god tier"
 *
 * Env:
 *   APPWRITE_ENDPOINT=https://appwrite.example/v1
 *   APPWRITE_PROJECT_ID=...
 *   APPWRITE_API_KEY=...
 * Optional:
 *   APPWRITE_DATABASE_ID=crypto
 *   APPWRITE_SUBSCRIPTIONS_COLLECTION_ID=subscriptions
 *
 * Notes:
 * - Never prints secrets.
 * - Uses REST via fetch to avoid SDK-version mismatches.
 */

import fs from "node:fs";

function parseArgs(argv) {
  const args = { email: "", status: "active", plan: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") {
      args.email = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--status") {
      args.status = argv[i + 1] || "active";
      i++;
      continue;
    }
    if (a === "--plan") {
      args.plan = argv[i + 1] || "";
      i++;
      continue;
    }
  }
  return args;
}

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalEnv(name, fallback) {
  return process.env[name] || fallback;
}

function isConflict(err) {
  return err && (err.status === 409 || err.code === 409);
}

async function appwriteFetch({ endpoint, headers }, method, path, body) {
  const res = await fetch(`${endpoint}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;
  if (res.ok) return json;

  const err = new Error((json && json.message) || `Appwrite error ${res.status} on ${method} ${path}`);
  err.status = res.status;
  err.type = json?.type;
  err.response = json;
  throw err;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  // Local default (repo includes `.env.appwrite`; gitignored by default)
  loadEnvFile(".env.appwrite");
  if (process.env.APPWRITE_ENV_FILE) loadEnvFile(process.env.APPWRITE_ENV_FILE);

  const args = parseArgs(process.argv.slice(2));
  if (!args.email) throw new Error("Missing required arg: --email");
  if (!args.plan) throw new Error("Missing required arg: --plan");

  const endpoint = requiredEnv("APPWRITE_ENDPOINT").replace(/\/$/, "");
  const projectId = requiredEnv("APPWRITE_PROJECT_ID");
  const apiKey = requiredEnv("APPWRITE_API_KEY");

  const databaseId = optionalEnv("APPWRITE_DATABASE_ID", "crypto");
  const subscriptionsCollectionId = optionalEnv("APPWRITE_SUBSCRIPTIONS_COLLECTION_ID", "subscriptions");

  const client = {
    endpoint,
    headers: {
      "content-type": "application/json",
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey
    }
  };

  // Find userId by email (exact match)
  const usersRes = await appwriteFetch(
    client,
    "GET",
    `/users?search=${encodeURIComponent(args.email)}`,
    undefined
  );
  const users = Array.isArray(usersRes?.users) ? usersRes.users : [];
  const user = users.find((u) => String(u?.email || "").toLowerCase() === args.email.toLowerCase());
  if (!user?.$id) throw new Error(`No Appwrite user found with email: ${args.email}`);

  const userId = user.$id;

  const permissions = [
    `read(\"user:${userId}\")`,
    `read(\"team:admins\")`,
    `update(\"team:admins\")`,
    `delete(\"team:admins\")`
  ];

  const data = {
    userId,
    status: args.status,
    plan: args.plan
  };

  try {
    await appwriteFetch(
      client,
      "POST",
      `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(
        subscriptionsCollectionId
      )}/documents`,
      {
        documentId: userId,
        data,
        permissions
      }
    );
    console.log(`✔ created subscription doc: ${databaseId}.${subscriptionsCollectionId}/${userId}`);
  } catch (err) {
    if (!isConflict(err)) throw err;
    await appwriteFetch(
      client,
      "PATCH",
      `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(
        subscriptionsCollectionId
      )}/documents/${encodeURIComponent(userId)}`,
      {
        data,
        permissions
      }
    );
    console.log(`↻ updated subscription doc: ${databaseId}.${subscriptionsCollectionId}/${userId}`);
  }
}

main().catch((err) => {
  console.error(err?.response || err?.message || err);
  process.exit(1);
});

