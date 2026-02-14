import test from "node:test";
import assert from "node:assert/strict";

import { hmacSha256Hex } from "./sellapp.js";
import { processSellappWebhook } from "./process-webhook.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

test("invalid signature returns invalid_signature and does not call Appwrite", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(500, { message: "should not be called" });
  };

  const res = await processSellappWebhook({
    req: {
      method: "POST",
      headers: { signature: "deadbeef" },
      bodyText: "{\"event\":\"order.completed\"}"
    },
    env: {
      SELLAPP_WEBHOOK_SECRET: "secret",
      APPWRITE_ENDPOINT: "https://example.com/v1",
      APPWRITE_PROJECT_ID: "proj",
      APPWRITE_API_KEY: "key",
      APPWRITE_DATABASE_ID: "crypto",
      APPWRITE_SUBSCRIPTIONS_COLLECTION_ID: "subscriptions",
      APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID: "webhook_events",
      APPWRITE_TEAM_PAID_ID: "paid"
    },
    fetchImpl
  });

  assert.deepEqual(res, { ok: false, error: "invalid_signature" });
  assert.equal(calls.length, 0);
});

test("duplicate webhook returns duplicate=true and skips side effects", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });

    if (url.includes("/collections/webhook_events/documents")) {
      return jsonResponse(409, { message: "Document already exists" });
    }

    return jsonResponse(500, { message: "unexpected call" });
  };

  const secret = "secret";
  const payload = { event: "order.completed", data: { id: 123, email: "customer@example.com" }, store: 1 };
  const bodyText = JSON.stringify(payload);

  const res = await processSellappWebhook({
    req: {
      method: "POST",
      headers: { signature: hmacSha256Hex(secret, bodyText) },
      bodyText,
      bodyJson: payload
    },
    env: {
      SELLAPP_WEBHOOK_SECRET: secret,
      APPWRITE_ENDPOINT: "https://example.com/v1",
      APPWRITE_PROJECT_ID: "proj",
      APPWRITE_API_KEY: "key",
      APPWRITE_DATABASE_ID: "crypto",
      APPWRITE_SUBSCRIPTIONS_COLLECTION_ID: "subscriptions",
      APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID: "webhook_events",
      APPWRITE_TEAM_PAID_ID: "paid"
    },
    fetchImpl
  });

  assert.deepEqual(res, { ok: true, duplicate: true });
  assert.equal(calls.length, 1);
});

test("order.completed upserts subscription and grants paid membership", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });

    if (url.includes("/collections/webhook_events/documents") && init.method === "POST") {
      return jsonResponse(201, { $id: "evt" });
    }

    if (url.endsWith("/users?search=customer%40example.com") && init.method === "GET") {
      return jsonResponse(200, {
        total: 1,
        users: [{ $id: "u1", email: "customer@example.com", name: "Cust" }]
      });
    }

    if (
      url.includes("/collections/subscriptions/documents/u1") &&
      init.method === "PUT"
    ) {
      return jsonResponse(201, { $id: "u1" });
    }

    if (url.includes("/teams/paid/memberships") && init.method === "GET") {
      return jsonResponse(200, { total: 0, memberships: [] });
    }

    if (url.includes("/teams/paid/memberships") && init.method === "POST") {
      return jsonResponse(201, { $id: "m1", userId: "u1" });
    }

    return jsonResponse(500, { message: `unexpected call: ${init.method} ${url}` });
  };

  const secret = "secret";
  const payload = { event: "order.completed", data: { id: 123, email: "customer@example.com" }, store: 1 };
  const bodyText = JSON.stringify(payload);

  const res = await processSellappWebhook({
    req: {
      method: "POST",
      headers: { signature: hmacSha256Hex(secret, bodyText) },
      bodyText,
      bodyJson: payload
    },
    env: {
      SELLAPP_WEBHOOK_SECRET: secret,
      APPWRITE_ENDPOINT: "https://example.com/v1",
      APPWRITE_PROJECT_ID: "proj",
      APPWRITE_API_KEY: "key",
      APPWRITE_DATABASE_ID: "crypto",
      APPWRITE_SUBSCRIPTIONS_COLLECTION_ID: "subscriptions",
      APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID: "webhook_events",
      APPWRITE_TEAM_PAID_ID: "paid"
    },
    fetchImpl
  });

  assert.deepEqual(res, { ok: true });

  const joined = calls.map((c) => `${c.init.method} ${c.url}`);
  assert.ok(joined.some((s) => s.includes("POST https://example.com/v1/databases/crypto/collections/webhook_events/documents")));
  assert.ok(joined.some((s) => s === "GET https://example.com/v1/users?search=customer%40example.com"));
  assert.ok(joined.some((s) => s.includes("PUT https://example.com/v1/databases/crypto/collections/subscriptions/documents/u1")));
  assert.ok(joined.some((s) => s === "GET https://example.com/v1/teams/paid/memberships"));
  assert.ok(joined.some((s) => s === "POST https://example.com/v1/teams/paid/memberships"));
});

