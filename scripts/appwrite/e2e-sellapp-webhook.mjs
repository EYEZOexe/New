/**
 * E2E smoke test for Sell.app -> Cloudflare Worker -> Appwrite Function pipeline.
 *
 * Flow:
 * 1) Create a fresh Appwrite user (unique email).
 * 2) Send `order.completed` webhook (expect: subscription active + paid team membership).
 * 3) Send the same `order.completed` again (expect: idempotent, no duplicate side effects).
 * 4) Send `order.disputed` (expect: subscription inactive + paid team membership removed).
 *
 * Usage:
 *   node scripts/appwrite/e2e-sellapp-webhook.mjs --env-file ..\\..\\..\\.env.appwrite
 */

import crypto from "node:crypto";
import fs from "node:fs";

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

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function httpJson({ method, url, headers = {}, body }) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

async function appwriteJson({ endpoint, projectId, apiKey, method, path, body }) {
  const url = `${endpoint.replace(/\/$/, "")}${path}`;
  const { ok, status, data } = await httpJson({
    method,
    url,
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey
    },
    body
  });
  if (ok) return data;

  const err = new Error((data && data.message) || `Appwrite error ${status} on ${method} ${path}`);
  err.status = status;
  err.response = data;
  throw err;
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function nowStamp() {
  // Short + stable, keeps userId under 36 chars.
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitUntil({ label, timeoutMs = 20_000, intervalMs = 750, fn }) {
  const start = Date.now();
  let lastErr = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (Date.now() - start >= timeoutMs) {
        const msg = lastErr?.message || String(lastErr);
        throw new Error(`Timed out waiting for ${label}: ${msg}`);
      }
      await sleep(intervalMs);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.envFile) loadEnvFile(args.envFile);

  const endpoint = requiredEnv("APPWRITE_ENDPOINT").replace(/\/$/, "");
  const projectId = requiredEnv("APPWRITE_PROJECT_ID");
  const apiKey = requiredEnv("APPWRITE_API_KEY");
  const sellappSecret = requiredEnv("SELLAPP_WEBHOOK_SECRET");

  const databaseId = process.env.APPWRITE_DATABASE_ID || "crypto";
  const subscriptionsCollectionId = process.env.APPWRITE_SUBSCRIPTIONS_COLLECTION_ID || "subscriptions";
  const webhookEventsCollectionId = process.env.APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID || "webhook_events";
  const teamPaidId = process.env.APPWRITE_TEAM_PAID_ID || "paid";

  const webhookUrl = process.env.SELLAPP_WEBHOOK_URL || "https://webhooks.g3netic.com/sell/webhook";

  const stamp = nowStamp();
  const userId = `e2e_${stamp}`;
  const email = `e2e+${stamp}@example.com`;
  const password = `Pw_${stamp}_12345`;

  console.log(`[e2e] webhookUrl=${webhookUrl}`);
  console.log(`[e2e] creating user userId=${userId} email=${email}`);

  await appwriteJson({
    endpoint,
    projectId,
    apiKey,
    method: "POST",
    path: "/users",
    body: { userId, email, password, name: `E2E ${stamp}` }
  });

  const store = "g3netic";
  const orderId = `order_${stamp}`;

  async function sendWebhook(event) {
    const payload = {
      event,
      store,
      data: {
        id: orderId,
        email
      }
    };
    const bodyText = JSON.stringify(payload);
    const sig = hmacSha256Hex(sellappSecret, bodyText);

    const res = await httpJson({
      method: "POST",
      url: webhookUrl,
      headers: { signature: sig },
      body: payload
    });

    console.log(`[e2e] POST ${event} -> ${res.status}`);
    if (!res.ok) {
      console.log(`[e2e] response body: ${JSON.stringify(res.data)}`);
      throw new Error(`Webhook call failed for ${event} (HTTP ${res.status})`);
    }
  }

  async function getSubscription() {
    try {
      return await appwriteJson({
        endpoint,
        projectId,
        apiKey,
        method: "GET",
        path: `/databases/${databaseId}/collections/${subscriptionsCollectionId}/documents/${userId}`
      });
    } catch (err) {
      // Newly-triggered function executions can take a moment to run; treat 404 as "not yet".
      if (err?.status === 404) throw err;
      throw err;
    }
  }

  async function getUserMemberships() {
    const res = await appwriteJson({
      endpoint,
      projectId,
      apiKey,
      method: "GET",
      path: `/users/${userId}/memberships`
    });
    return Array.isArray(res?.memberships) ? res.memberships : [];
  }

  async function getWebhookEventDocId(event) {
    const eventId = `${event}:${orderId}:${store}`;
    return sha256Hex(eventId).slice(0, 36);
  }

  async function assertPaidMembership(expected) {
    const memberships = await getUserMemberships();
    const hasPaid = memberships.some((m) => m?.teamId === teamPaidId);
    assert(hasPaid === expected, `expected paid membership=${expected}, got ${hasPaid}`);
  }

  // 1) order.completed -> active + paid membership
  await sendWebhook("order.completed");
  const sub1 = await waitUntil({
    label: "subscription to become active",
    fn: async () => {
      const s = await getSubscription();
      assert(s?.status === "active", `expected subscription.status=active, got ${s?.status}`);
      return s;
    }
  });
  await waitUntil({
    label: "paid team membership to be granted",
    fn: async () => {
      await assertPaidMembership(true);
      return true;
    }
  });

  // 2) order.completed again -> idempotent (still active + paid)
  await sendWebhook("order.completed");
  const sub2 = await waitUntil({
    label: "subscription to remain active after duplicate",
    fn: async () => {
      const s = await getSubscription();
      assert(s?.status === "active", `expected subscription.status=active after duplicate, got ${s?.status}`);
      return s;
    }
  });
  await waitUntil({
    label: "paid team membership to remain granted after duplicate",
    fn: async () => {
      await assertPaidMembership(true);
      return true;
    }
  });

  // Confirm webhook_events doc exists for completed
  {
    const docId = await getWebhookEventDocId("order.completed");
    const ev = await appwriteJson({
      endpoint,
      projectId,
      apiKey,
      method: "GET",
      path: `/databases/${databaseId}/collections/${webhookEventsCollectionId}/documents/${docId}`
    });
    assert(ev?.provider === "sellapp", `expected webhook_events.provider=sellapp, got ${ev?.provider}`);
  }

  // 3) order.disputed -> inactive + paid removed
  await sendWebhook("order.disputed");
  const sub3 = await waitUntil({
    label: "subscription to become inactive",
    fn: async () => {
      const s = await getSubscription();
      assert(s?.status === "inactive", `expected subscription.status=inactive, got ${s?.status}`);
      return s;
    }
  });
  await waitUntil({
    label: "paid team membership to be revoked",
    fn: async () => {
      await assertPaidMembership(false);
      return true;
    }
  });

  console.log("[e2e] OK: grant, idempotency, revoke verified");
}

main().catch((err) => {
  console.error(`[e2e] FAILED: ${err?.message || String(err)}`);
  if (err?.status) console.error(`[e2e] status: ${err.status}`);
  process.exitCode = 1;
});
