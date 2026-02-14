import test from "node:test";
import assert from "node:assert/strict";

import { buildPruneQueries, createHandler } from "./index.js";

test("buildPruneQueries includes lessThan $createdAt cutoff and limit", () => {
  const cutoffIso = "2026-02-07T00:00:00.000Z";
  const q = buildPruneQueries({ cutoffIso, limit: 123 });
  assert.equal(q[0], `lessThan(\"$createdAt\",\"${cutoffIso}\")`);
  assert.equal(q[2], "limit(123)");
});

test("handler issues DELETE to bulk delete endpoint with queries[]", async () => {
  const seen = [];

  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ total: 0, documents: [] })
    };
  };

  const handler = createHandler({
    env: {
      APPWRITE_ENDPOINT: "https://example.com/v1",
      APPWRITE_PROJECT_ID: "proj",
      APPWRITE_API_KEY: "key",
      APPWRITE_DATABASE_ID: "crypto",
      APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID: "webhook_failures",
      WEBHOOK_FAILURE_RETENTION_DAYS: "7",
      WEBHOOK_FAILURE_PRUNE_LIMIT: "200"
    },
    fetchImpl
  });

  const logs = [];
  const out = [];
  await handler({
    req: { method: "POST" },
    res: { json: (v) => out.push(v) },
    log: (m) => logs.push(String(m)),
    error: (m) => logs.push(`ERR:${String(m)}`)
  });

  assert.equal(out[0]?.ok, true);
  assert.ok(seen.length >= 1);
  assert.equal(seen[0].init.method, "DELETE");
  assert.ok(
    seen[0].url.includes("/databases/crypto/collections/webhook_failures/documents?"),
    `unexpected url: ${seen[0].url}`
  );
  assert.ok(seen[0].url.includes("queries%5B%5D="), "expected queries[] param");
});

