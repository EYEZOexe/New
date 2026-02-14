import test from "node:test";
import assert from "node:assert/strict";

import { hmacSha256Hex } from "./sellapp.js";
import { createHandler } from "./index.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

test("index handler returns the processSellappWebhook result via res.json", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });

    if (url.includes("/collections/webhook_events/documents") && init.method === "POST") {
      return jsonResponse(201, { $id: "evt" });
    }
    if (url.endsWith("/users?search=customer%40example.com") && init.method === "GET") {
      return jsonResponse(200, { total: 1, users: [{ $id: "u1", email: "customer@example.com", name: "Cust" }] });
    }
    if (url.includes("/collections/subscriptions/documents") && init.method === "POST") {
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

  const env = {
    SELLAPP_WEBHOOK_SECRET: "secret",
    APPWRITE_ENDPOINT: "https://example.com/v1",
    APPWRITE_PROJECT_ID: "proj",
    APPWRITE_API_KEY: "key",
    APPWRITE_DATABASE_ID: "crypto",
    APPWRITE_SUBSCRIPTIONS_COLLECTION_ID: "subscriptions",
    APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID: "webhook_events",
    APPWRITE_TEAM_PAID_ID: "paid"
  };

  const payload = { event: "order.completed", data: { id: 123, email: "customer@example.com" }, store: 1 };
  const bodyText = JSON.stringify(payload);

  const handler = createHandler({ env, fetchImpl });

  let jsonOut = null;
  await handler({
    req: {
      method: "POST",
      headers: { signature: hmacSha256Hex(env.SELLAPP_WEBHOOK_SECRET, bodyText) },
      bodyText,
      bodyJson: payload
    },
    res: {
      json: (v) => {
        jsonOut = v;
        return v;
      }
    },
    log: () => {},
    error: () => {}
  });

  assert.deepEqual(jsonOut, { ok: true });
  assert.ok(calls.length > 0);
});
