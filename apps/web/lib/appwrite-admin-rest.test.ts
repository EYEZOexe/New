import test from "node:test";
import assert from "node:assert/strict";

import { createAppwriteAdminRestClient } from "./appwrite-admin-rest";

test("createAppwriteAdminRestClient sends required auth headers", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const fetchImpl: typeof fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 200, text: async () => JSON.stringify({ $id: "doc" }) } as any;
  }) as any;

  const aw = createAppwriteAdminRestClient({
    endpoint: "https://appwrite.example/v1",
    projectId: "proj",
    apiKey: "key",
    fetchImpl
  });

  await aw.getDocument({ databaseId: "crypto", collectionId: "subscriptions", documentId: "u1" });

  assert.equal(calls.length, 1);
  assert.equal((calls[0]!.init.headers as any)["X-Appwrite-Project"], "proj");
  assert.equal((calls[0]!.init.headers as any)["X-Appwrite-Key"], "key");
});

test("upsertDocumentPut uses PUT and JSON body", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const fetchImpl: typeof fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 201, text: async () => JSON.stringify({ $id: "doc" }) } as any;
  }) as any;

  const aw = createAppwriteAdminRestClient({
    endpoint: "https://appwrite.example/v1",
    projectId: "proj",
    apiKey: "key",
    fetchImpl
  });

  await aw.upsertDocumentPut({
    databaseId: "crypto",
    collectionId: "profiles",
    documentId: "u1",
    data: { userId: "u1", discordUserId: "123" }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.init.method, "PUT");
  assert.ok(String(calls[0]!.init.body).includes("\"discordUserId\""));
});

