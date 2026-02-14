import test from "node:test";
import assert from "node:assert/strict";

import { createAppwriteRestClient } from "./appwrite-rest.js";

test("createAppwriteRestClient sends required auth headers", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ total: 0, users: [] })
    };
  };

  const aw = createAppwriteRestClient({
    endpoint: "https://example.com/v1",
    projectId: "proj",
    apiKey: "key",
    fetchImpl
  });

  await aw.listUsers({ search: "a@b.com" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["X-Appwrite-Project"], "proj");
  assert.equal(calls[0].init.headers["X-Appwrite-Key"], "key");
});

test("updateDocument uses PATCH and JSON body", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ $id: "doc" })
    };
  };

  const aw = createAppwriteRestClient({
    endpoint: "https://example.com/v1",
    projectId: "proj",
    apiKey: "key",
    fetchImpl
  });

  await aw.updateDocument({
    databaseId: "crypto",
    collectionId: "subscriptions",
    documentId: "user123",
    data: { userId: "user123", status: "active" }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "PATCH");
  assert.ok(String(calls[0].init.body).includes("\"status\""));
});
