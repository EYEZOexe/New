/**
 * Deploy the prune-webhook-failures Appwrite Function via REST.
 *
 * Usage:
 *   node scripts/appwrite/deploy-prune-webhook-failures.mjs --env-file .env.appwrite
 */

import fs from "node:fs";
import path from "node:path";
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
  const result = spawnSync("tar", ["-czf", outFile, "-C", cwd, "."], {
    stdio: "inherit"
  });
  if (result.status !== 0) throw new Error(`tar failed with exit code ${result.status}`);
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

  const databaseId = process.env.APPWRITE_DATABASE_ID || "crypto";
  const webhookFailuresCollectionId =
    process.env.APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID || "webhook_failures";

  const functionId = process.env.APPWRITE_PRUNE_WEBHOOK_FAILURES_FUNCTION_ID || "prune-webhook-failures";
  const functionName = "prune-webhook-failures";
  const runtime = "node-20.0";
  const schedule = process.env.PRUNE_WEBHOOK_FAILURES_CRON || "0 3 * * *";

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
    timeout: 30,
    entrypoint: "src/index.js",
    commands: "npm install",
    schedule,
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

  const repoRoot = path.resolve(process.cwd());
  const srcDir = path.join(repoRoot, "functions", "prune-webhook-failures");
  const outDir = path.join(repoRoot, ".tmp");
  ensureDir(outDir);
  const tarPath = path.join(outDir, "prune-webhook-failures.tar.gz");
  tarDirectory({ cwd: srcDir, outFile: tarPath });

  const codeBuf = fs.readFileSync(tarPath);
  const fd = new FormData();
  fd.append("activate", "true");
  fd.append("entrypoint", "src/index.js");
  fd.append("code", new Blob([codeBuf], { type: "application/gzip" }), "code.tar.gz");

  const deployment = await appwriteFetch({
    endpoint,
    projectId,
    apiKey,
    method: "POST",
    path: `/functions/${functionId}/deployments`,
    json: false,
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey
    },
    body: fd
  });

  const deploymentId = deployment?.$id || deployment?.deploymentId;
  if (!deploymentId) throw new Error("Missing deploymentId from Appwrite response");

  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_ENDPOINT", value: endpoint, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_PROJECT_ID", value: projectId, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_API_KEY", value: apiKey, secret: true });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_DATABASE_ID", value: databaseId, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID", value: webhookFailuresCollectionId, secret: false });
  await upsertVariableRest({ endpoint, projectId, apiKey, functionId, key: "WEBHOOK_FAILURE_RETENTION_DAYS", value: process.env.WEBHOOK_FAILURE_RETENTION_DAYS || "7", secret: false });

  let status = "";
  for (let i = 0; i < 60; i++) {
    const d = await appwriteFetch({
      endpoint,
      projectId,
      apiKey,
      method: "GET",
      path: `/functions/${functionId}/deployments/${deploymentId}`
    });
    status = d?.status;
    if (status === "ready" || status === "failed") break;
    await sleep(2000);
  }

  console.log("\nDeployed function:");
  console.log(`- functionId:   ${functionId}`);
  console.log(`- runtime:      ${runtime}`);
  console.log(`- schedule:     ${schedule}`);
  console.log(`- deploymentId: ${deploymentId}`);
  console.log(`- status:       ${status}`);
}

main().catch((err) => {
  console.error(err?.response || err);
  process.exit(1);
});

