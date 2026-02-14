# Sell.app Webhook (Pure REST) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `node-appwrite` usage inside `functions/sellapp-webhook` with direct Appwrite REST calls, keeping stable IDs and preserving current webhook behavior (signature verification, idempotency, subscription upsert, paid team grant/revoke).

**Architecture:** Keep `src/index.js` as a thin Appwrite Function entrypoint. Move webhook parsing/signature logic into `src/sellapp.js`. Move Appwrite REST adapter into `src/appwrite-rest.js` with dependency-injected `fetch` for unit tests.

**Tech Stack:** Node.js (Appwrite Function runtime), built-in `node:test`, `crypto`, Appwrite REST API.

---

### Task 1: Add Node Test Harness For The Function Package

**Files:**
- Modify: `functions/sellapp-webhook/package.json`
- Create: `functions/sellapp-webhook/src/sellapp.test.js`

**Step 1: Write the failing test**

Create `functions/sellapp-webhook/src/sellapp.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { hmacSha256Hex, verifySellappSignature } from "./sellapp.js";

test("verifySellappSignature rejects invalid signature", () => {
  const secret = "secret";
  const bodyText = "{\"hello\":\"world\"}";

  assert.equal(verifySellappSignature({ secret, bodyText, signatureHeader: "deadbeef" }), false);
});

test("verifySellappSignature accepts valid signature", () => {
  const secret = "secret";
  const bodyText = "{\"hello\":\"world\"}";
  const sig = hmacSha256Hex(secret, bodyText);

  assert.equal(verifySellappSignature({ secret, bodyText, signatureHeader: sig }), true);
});
```

**Step 2: Add a test script (still failing)**

Modify `functions/sellapp-webhook/package.json`:

```json
{
  "scripts": {
    "test": "node --test"
  }
}
```

**Step 3: Run test to verify it fails**

Run:

```powershell
pnpm -C functions/sellapp-webhook test
```

Expected: FAIL because `./sellapp.js` does not exist.

**Step 4: Commit**

```powershell
git add functions/sellapp-webhook/package.json functions/sellapp-webhook/src/sellapp.test.js

git commit -m "test(sellapp-webhook): add node:test harness"
```

---

### Task 2: Implement Sell.app Helper Module (Signature, Email, Event Mapping)

**Files:**
- Create: `functions/sellapp-webhook/src/sellapp.js`
- Test: `functions/sellapp-webhook/src/sellapp.test.js`

**Step 1: Write minimal implementation to pass existing tests**

Create `functions/sellapp-webhook/src/sellapp.js`:

```js
import crypto from "node:crypto";

export function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqualHex(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifySellappSignature({ secret, bodyText, signatureHeader }) {
  const computed = hmacSha256Hex(secret, bodyText ?? "");
  return timingSafeEqualHex(computed, signatureHeader ?? "");
}

export function pickEmail(payload) {
  const candidates = [
    payload?.data?.email,
    payload?.data?.customer?.email,
    payload?.data?.order?.email,
    payload?.data?.order?.customer_email,
    payload?.data?.billing?.email,
    payload?.customer?.email,
    payload?.order?.email
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c.trim().toLowerCase();
  }
  return null;
}

export function mapSellappEventToAction(event) {
  if (event === "order.completed") return { subscriptionStatus: "active", teamAction: "grant" };
  if (event === "order.disputed") return { subscriptionStatus: "inactive", teamAction: "revoke" };
  return { subscriptionStatus: null, teamAction: null };
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
```

**Step 2: Run tests**

Run:

```powershell
pnpm -C functions/sellapp-webhook test
```

Expected: PASS.

**Step 3: Commit**

```powershell
git add functions/sellapp-webhook/src/sellapp.js

git commit -m "feat(sellapp-webhook): add sellapp helpers (signature, mapping)"
```

---

### Task 3: Add Appwrite REST Adapter (Unit-Tested)

**Files:**
- Create: `functions/sellapp-webhook/src/appwrite-rest.test.js`
- Create: `functions/sellapp-webhook/src/appwrite-rest.js`

**Step 1: Write failing tests for request shapes**

Create `functions/sellapp-webhook/src/appwrite-rest.test.js`:

```js
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

test("upsertDocumentPut uses PUT and JSON body", async () => {
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

  await aw.upsertDocumentPut({
    databaseId: "crypto",
    collectionId: "subscriptions",
    documentId: "user123",
    data: { userId: "user123", status: "active" }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "PUT");
  assert.ok(String(calls[0].init.body).includes("\"status\""));
});
```

**Step 2: Run tests to verify failure**

Run:

```powershell
pnpm -C functions/sellapp-webhook test
```

Expected: FAIL because `appwrite-rest.js` does not exist.

**Step 3: Implement adapter**

Create `functions/sellapp-webhook/src/appwrite-rest.js`:

```js
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function createAppwriteRestClient({ endpoint, projectId, apiKey, fetchImpl = fetch }) {
  const base = String(endpoint).replace(/\/$/, "");

  async function requestJson({ method, path, body }) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await res.text();
    const data = text ? safeJsonParse(text) : null;

    if (res.ok) return data;

    const err = new Error((data && data.message) || `Appwrite error ${res.status} on ${method} ${path}`);
    err.status = res.status;
    err.response = data;
    throw err;
  }

  function qs(params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) usp.append(k, String(item));
      } else {
        usp.set(k, String(v));
      }
    }
    const s = usp.toString();
    return s ? `?${s}` : "";
  }

  return {
    listUsers: ({ search }) => requestJson({ method: "GET", path: `/users${qs({ search })}` }),

    listMemberships: ({ teamId, queries, search }) =>
      requestJson({ method: "GET", path: `/teams/${teamId}/memberships${qs({ "queries[]": queries, search })}` }),

    createMembership: ({ teamId, roles, userId, name, url }) =>
      requestJson({
        method: "POST",
        path: `/teams/${teamId}/memberships`,
        body: { roles, userId, name, url }
      }),

    deleteMembership: ({ teamId, membershipId }) =>
      requestJson({ method: "DELETE", path: `/teams/${teamId}/memberships/${membershipId}` }),

    createDocument: ({ databaseId, collectionId, documentId, data }) =>
      requestJson({
        method: "POST",
        path: `/databases/${databaseId}/collections/${collectionId}/documents`,
        body: { documentId, data }
      }),

    upsertDocumentPut: ({ databaseId, collectionId, documentId, data }) =>
      requestJson({
        method: "PUT",
        path: `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
        body: { data }
      })
  };
}
```

**Step 4: Run tests**

Run:

```powershell
pnpm -C functions/sellapp-webhook test
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add functions/sellapp-webhook/src/appwrite-rest.js functions/sellapp-webhook/src/appwrite-rest.test.js

git commit -m "feat(sellapp-webhook): add appwrite REST adapter"
```

---

### Task 4: Switch Webhook Handler To Pure REST

**Files:**
- Modify: `functions/sellapp-webhook/src/index.js`
- Modify: `functions/sellapp-webhook/README.md`

**Step 1: Write a failing integration-style unit test (mocking fetch)**

Modify `functions/sellapp-webhook/src/sellapp.test.js` to add:

```js
import { createAppwriteRestClient } from "./appwrite-rest.js";
import { pickEmail, mapSellappEventToAction } from "./sellapp.js";

test("grant flow calls createMembership for order.completed", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });

    if (url.endsWith("/users?search=customer%40example.com")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ total: 1, users: [{ $id: "u1", email: "customer@example.com", name: "Cust" }] })
      };
    }

    if (url.includes("/webhook_events/") || url.includes("/collections/webhook_events")) {
      return { ok: true, status: 201, text: async () => JSON.stringify({ $id: "e1" }) };
    }

    return { ok: true, status: 201, text: async () => JSON.stringify({}) };
  };

  const aw = createAppwriteRestClient({ endpoint: "https://example.com/v1", projectId: "p", apiKey: "k", fetchImpl });

  const payload = { event: "order.completed", data: { email: "customer@example.com", id: 123 }, store: 1 };
  assert.equal(pickEmail(payload), "customer@example.com");
  assert.deepEqual(mapSellappEventToAction(payload.event), { subscriptionStatus: "active", teamAction: "grant" });

  // This test will be fully wired once index.js exposes a testable function or we add a small processWebhook module.
  assert.ok(aw);
  assert.ok(Array.isArray(calls));
});
```

Run:

```powershell
pnpm -C functions/sellapp-webhook test
```

Expected: FAIL until the handler wiring is refactored to be testable.

**Step 2: Refactor `src/index.js` to use the REST adapter**

Modify `functions/sellapp-webhook/src/index.js`:

- Remove `node-appwrite` usage.
- Import `createAppwriteRestClient` and helpers.
- Implement logic:
  - validate signature using `req.bodyText`
  - idempotency by `createDocument` into `webhook_events` and treat `409` as duplicate
  - find user by email using `listUsers(search=email)` and exact-match filter
  - upsert subscription using `upsertDocumentPut`
  - grant/revoke paid membership using `listMemberships` + `createMembership` + `deleteMembership`

Keep response shapes consistent with current behavior.

**Step 3: Update docs**

Update `functions/sellapp-webhook/README.md` to remove `node-appwrite` references and mention REST endpoints.

**Step 4: Run tests**

```powershell
pnpm -C functions/sellapp-webhook test
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add functions/sellapp-webhook/src/index.js functions/sellapp-webhook/README.md functions/sellapp-webhook/src/sellapp.test.js

git commit -m "feat(sellapp-webhook): use Appwrite REST inside handler"
```

---

### Task 5: Remove `node-appwrite` Dependency From The Function

**Files:**
- Modify: `functions/sellapp-webhook/package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Remove dependency**

Edit `functions/sellapp-webhook/package.json` to remove `node-appwrite` from `dependencies`.

**Step 2: Reinstall**

Run:

```powershell
pnpm -w install
```

Expected: lockfile updates.

**Step 3: Run checks**

Run:

```powershell
pnpm -C functions/sellapp-webhook test
pnpm -w typecheck
```

Expected: PASS.

**Step 4: Commit**

```powershell
git add functions/sellapp-webhook/package.json pnpm-lock.yaml

git commit -m "chore(sellapp-webhook): drop node-appwrite dependency"
```

---

### Task 6: Wire New Env Var Into Deploy Script (Optional)

**Files:**
- Modify: `scripts/appwrite/deploy-sellapp-webhook.mjs`
- Modify: `.env.appwrite.example`

**Step 1: Add optional variable upsert**

If `APP_BASE_URL` is set in `.env.appwrite`, upsert it as a non-secret function variable.

**Step 2: Update example env file**

Add a commented line:

- `# APP_BASE_URL=https://g3netic.com` (or your actual web origin)

**Step 3: Commit**

```powershell
git add scripts/appwrite/deploy-sellapp-webhook.mjs .env.appwrite.example

git commit -m "chore(appwrite): pass APP_BASE_URL to sellapp webhook"
```

---

### Task 7: Deploy And Smoke Test Execution

**Files:**
- None

**Step 1: Deploy**

Run:

```powershell
pnpm appwrite:deploy:sellapp-webhook
```

Expected: deployment status `ready`.

**Step 2: Probe an execution (no domain needed)**

Run:

```powershell
node scripts/appwrite/probe-function-execution.mjs --env-file .env.appwrite --function-id sellapp-webhook
```

Expected: a 2xx response or a clear error message indicating which env var is missing.

---

### Task 8: Roadmap Hygiene

**Files:**
- Modify: `docs/roadmap.md`

**Step 1: Update milestone items**

- Mark the relevant webhook tasks as complete with date `2026-02-14` once the webhook processes a real payload end-to-end.
- Add a link to:
  - `docs/plans/2026-02-14-sellapp-webhook-pure-rest-design.md`
  - `docs/plans/2026-02-14-sellapp-webhook-pure-rest-plan.md`

**Step 2: Commit**

```powershell
git add docs/roadmap.md

git commit -m "docs(roadmap): reflect sellapp webhook REST implementation"
```

---

Plan complete and saved to `docs/plans/2026-02-14-sellapp-webhook-pure-rest-plan.md`.

Two execution options:

1. Subagent-Driven (this session)
2. Parallel Session (separate)

Which approach?
