/**
 * DEPRECATED: Prefer running Appwrite operational workflows via MCP.
 * See `docs/appwrite-mcp-ops.md`.
 *
 * Deploy the sell.app webhook Appwrite Function using **Appwrite REST**.
 *
 * This avoids:
 * - Node SDK version mismatch (SDK warns for 1.8.x while server is 1.7.4)
 * - MCP server file-upload limitations for function deployments
 *
 * What it does:
 * - Ensures the function exists and is configured (execute:any, runtime node-20.0)
 * - Packages `functions/sellapp-webhook` into a tar.gz
 * - Uploads a deployment and activates it
 * - Upserts function variables
 * - Waits until deployment status is `ready`
 *
 * Usage:
 *   node scripts/appwrite/deploy-sellapp-webhook.mjs --env-file .env.appwrite
 */

import fs from "node:fs";
import path from "node:path";
import { Blob } from "node:buffer";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = { envFile: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env-file") {
      args.envFile = argv[i + 1];
      i++;
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

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function tarDirectory({ cwd, outFile }) {
  // Uses system tar. On Windows 11, bsdtar is available as `tar`.
  const result = spawnSync("tar", ["-czf", outFile, "-C", cwd, "."], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`tar failed with exit code ${result.status}`);
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildHeaders({ projectId, apiKey, json = true } = {}) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Key": apiKey
  };
}

async function appwriteFetch({ endpoint, projectId, apiKey, method, path, body, json = true, headers = {} }) {
  const url = `${endpoint.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method,
    headers: { ...buildHeaders({ projectId, apiKey, json }), ...headers },
    body: body === undefined ? undefined : json ? JSON.stringify(body) : body
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;
  if (res.ok) return data;

  const err = new Error((data && data.message) || `Appwrite error ${res.status} on ${method} ${path}`);
  err.status = res.status;
  err.response = data;
  throw err;
}

async function upsertVariableRest({ endpoint, projectId, apiKey, functionId, key, value, secret }) {
  const list = await appwriteFetch({
    endpoint,
    projectId,
    apiKey,
    method: "GET",
    path: `/functions/${functionId}/variables`
  });

  const existing = list?.variables?.find((v) => v.key === key) ?? null;
  if (!existing) {
    await appwriteFetch({
      endpoint,
      projectId,
      apiKey,
      method: "POST",
      path: `/functions/${functionId}/variables`,
      body: { key, value, secret }
    });
    return;
  }

  await appwriteFetch({
    endpoint,
    projectId,
    apiKey,
    method: "PUT",
    path: `/functions/${functionId}/variables/${existing.$id}`,
    body: { key, value, secret }
  });
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.envFile) loadEnvFile(args.envFile);

  const endpoint = requiredEnv("APPWRITE_ENDPOINT").replace(/\/$/, "");
  const projectId = requiredEnv("APPWRITE_PROJECT_ID");
  const apiKey = requiredEnv("APPWRITE_API_KEY");
  const sellappSecret = requiredEnv("SELLAPP_WEBHOOK_SECRET");

  const databaseId = process.env.APPWRITE_DATABASE_ID || "crypto";
  const subscriptionsCollectionId =
    process.env.APPWRITE_SUBSCRIPTIONS_COLLECTION_ID || "subscriptions";
  const webhookEventsCollectionId =
    process.env.APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID || "webhook_events";
  const teamPaidId = process.env.APPWRITE_TEAM_PAID_ID || "paid";

  const functionId = process.env.APPWRITE_SELLAPP_WEBHOOK_FUNCTION_ID || "sellapp-webhook";
  const functionName = "sellapp-webhook";

  // Provided by you from console (Runtime label: “Node.js - 20.0”).
  // Appwrite expects runtime ID:
  const runtime = "node-20.0";

  // Ensure function exists + configured
  let exists = true;
  try {
    await appwriteFetch({ endpoint, projectId, apiKey, method: "GET", path: `/functions/${functionId}` });
  } catch (err) {
    if (err?.status === 404) exists = false;
    else throw err;
  }

  const functionPayload = {
    name: functionName,
    runtime,
    execute: ["any"],
    enabled: true,
    logging: true,
    timeout: 15,
    entrypoint: "src/index.js",
    commands: "npm install",
    specification: "s-1vcpu-512mb"
  };

  if (!exists) {
    await appwriteFetch({
      endpoint,
      projectId,
      apiKey,
      method: "POST",
      path: `/functions`,
      body: { functionId, ...functionPayload }
    });
  } else {
    await appwriteFetch({
      endpoint,
      projectId,
      apiKey,
      method: "PUT",
      path: `/functions/${functionId}`,
      body: functionPayload
    });
  }

  // Package code
  const repoRoot = path.resolve(process.cwd());
  const srcDir = path.join(repoRoot, "functions", "sellapp-webhook");
  const outDir = path.join(repoRoot, ".tmp");
  ensureDir(outDir);
  const tarPath = path.join(outDir, "sellapp-webhook.tar.gz");
  tarDirectory({ cwd: srcDir, outFile: tarPath });

  // Upload deployment (multipart)
  const codeBuf = fs.readFileSync(tarPath);
  const fd = new FormData();
  fd.append("activate", "true");
  fd.append("entrypoint", "src/index.js");
  fd.append("commands", "npm install");
  fd.append("code", new Blob([codeBuf]), "code.tar.gz");

  const deployment = await appwriteFetch({
    endpoint,
    projectId,
    apiKey,
    method: "POST",
    path: `/functions/${functionId}/deployments`,
    body: fd,
    json: false
  });

  const deploymentId = deployment?.$id;
  if (!deploymentId) throw new Error("Deployment created but no deployment id returned");

  // Set function variables
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "SELLAPP_WEBHOOK_SECRET", value: sellappSecret, secret: true });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_ENDPOINT", value: endpoint, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_PROJECT_ID", value: projectId, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_API_KEY", value: apiKey, secret: true });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_DATABASE_ID", value: databaseId, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_SUBSCRIPTIONS_COLLECTION_ID", value: subscriptionsCollectionId, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID", value: webhookEventsCollectionId, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_TEAM_PAID_ID", value: teamPaidId, secret: false });

  // Optional: used as `url` when creating team memberships (some Appwrite versions/platform settings
  // may still validate this even with API keys).
  if (process.env.APP_BASE_URL) {
    await upsertVariableRest({
      endpoint,
      projectId,
      apiKey,
      functionId,
      key: "APP_BASE_URL",
      value: process.env.APP_BASE_URL,
      secret: false
    });
  }

  // Wait for build to be ready
  let status = "";
  for (let i = 0; i < 60; i++) {
    const d = await appwriteFetch({ endpoint, projectId, apiKey, method: "GET", path: `/functions/${functionId}/deployments/${deploymentId}` });
    status = d?.status;
    if (status === "ready" || status === "failed") break;
    await sleep(2000);
  }

  console.log("\nDeployed function:");
  console.log(`- functionId:   ${functionId}`);
  console.log(`- runtime:      ${runtime}`);
  console.log(`- deploymentId: ${deploymentId}`);
  console.log(`- status:       ${status}`);

  const recommendedWebhookUrl = process.env.SELLAPP_WEBHOOK_URL || "https://webhooks.g3netic.com/sell/webhook";
  console.log("\nNext:");
  console.log(`- Set Sell.app webhook URL to: ${recommendedWebhookUrl}`);
  console.log("- No Appwrite Function Domains required when using a Cloudflare Worker proxy URL.");
}

main().catch((err) => {
  console.error(err?.response || err);
  process.exit(1);
});
