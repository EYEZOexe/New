# Webhook Failure Capture + Replay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist retryable webhook failures (raw payload + error) for 7 days, and add replay + scheduled prune.

**Architecture:** Add an admin-only `webhook_failures` collection. Webhook handler writes failure records (best-effort) only after signature verification. A scheduled Appwrite function prunes failures older than 7 days. A CLI script replays failures via the Cloudflare Worker URL.

**Tech Stack:** Appwrite (REST), Node.js functions (ESM), `node:test`, pnpm/turbo.

---

### Task 1: Add `webhook_failures` to Appwrite bootstrap

**Files:**
- Modify: `scripts/appwrite/bootstrap.mjs`

**Step 1: Add defaults/env plumbing**
- Add `DEFAULTS.collections.webhookFailures = "webhook_failures"`
- Add env override `APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID`

**Step 2: Add a longtext attribute helper (needed for raw body)**
- Add `ensureLongTextAttribute()` using:
  - `POST /databases/{databaseId}/collections/{collectionId}/attributes/longtext`

**Step 3: Ensure the collection**
- Create `webhook_failures` with admin-only permissions and `documentSecurity: false`.

**Step 4: Add attributes**
- Add:
  - `provider` (string 32, required)
  - `event` (string 64, required)
  - `eventId` (string 256, required)
  - `orderId` (string 128, optional)
  - `store` (string 128, optional)
  - `email` (string 256, optional)
  - `payloadHash` (string 128, optional)
  - `bodyText` (longtext, required)
  - `errorCode` (string 64, required)
  - `errorMessage` (string 1024, optional)
  - `errorStatus` (integer optional) if supported, else string
  - `errorType` (string 128, optional)

**Step 5: Add indexes**
- `idx_eventId` (key) on `eventId`
- `idx_errorCode` (key) on `errorCode`

**Step 6: Update the “Use these IDs” printout**
- Print `APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID=...`

**Step 7: Dry-run sanity**
Run: `node scripts/appwrite/bootstrap.mjs --dry-run --env-file .env.appwrite`
Expected: logs include creating `collection:webhook_failures` and its attributes/indexes.

**Step 8: Commit**
```bash
git add scripts/appwrite/bootstrap.mjs
git commit -m "feat(appwrite): add webhook_failures collection"
```

---

### Task 2: Record failures from `sellapp-webhook` (TDD)

**Files:**
- Modify: `functions/sellapp-webhook/src/process-webhook.js`
- Modify: `functions/sellapp-webhook/src/appwrite-rest.js`
- Modify: `scripts/appwrite/deploy-sellapp-webhook.mjs`
- Test: `functions/sellapp-webhook/src/process-webhook.test.js`

**Step 1: Add REST helpers**
- Add `createWebhookFailure()` method (or generic `createDocument` already exists) usage with `documentId: "unique()"`.
- Ensure collection id env var:
  - `APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID` (default `webhook_failures`)

**Step 2: Write failing tests**
- Add tests that:
  - After valid signature, `user_not_found` creates a failure document in `webhook_failures`.
  - After valid signature, `no_email_in_payload` creates a failure document.
  - Appwrite exception (simulate non-409 error) creates a failure document with error details.

**Step 3: Run tests (must fail)**
Run: `cd functions/sellapp-webhook && node --test`
Expected: failing assertions about missing failure document creation.

**Step 4: Implement minimal failure recording**
- Add `recordFailure()` that:
  - accepts `errorCode`, `error`, and context
  - writes `bodyText` + metadata to `webhook_failures`
  - swallows its own errors
- Only call after signature verification succeeds.

**Step 5: Run tests (must pass)**
Run: `cd functions/sellapp-webhook && node --test`
Expected: PASS.

**Step 6: Ensure deploy script sets the new variable**
- Upsert `APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID` in `scripts/appwrite/deploy-sellapp-webhook.mjs`.

**Step 7: Commit**
```bash
git add functions/sellapp-webhook/src/process-webhook.js functions/sellapp-webhook/src/appwrite-rest.js functions/sellapp-webhook/src/process-webhook.test.js scripts/appwrite/deploy-sellapp-webhook.mjs
git commit -m "feat(sellapp-webhook): record retryable failures"
```

---

### Task 3: Add scheduled prune function (7-day retention)

**Files:**
- Create: `functions/prune-webhook-failures/package.json`
- Create: `functions/prune-webhook-failures/src/index.js`
- Create: `functions/prune-webhook-failures/README.md`
- Create: `scripts/appwrite/deploy-prune-webhook-failures.mjs`
- Test: `functions/prune-webhook-failures/src/index.test.js`

**Step 1: Write failing unit test**
- Test that cutoff date is “now minus 7 days” and request hits:
  - `DELETE /databases/crypto/collections/webhook_failures/documents` with `queries[]` including `lessThan("$createdAt", cutoffIso)`

**Step 2: Run test (must fail)**
Run: `cd functions/prune-webhook-failures && node --test`

**Step 3: Implement function**
- REST call using API key.
- Delete in a loop if needed (repeat until `total === 0`).
- Return `{ ok: true, deletedTotal }`.

**Step 4: Run test (must pass)**
Run: `cd functions/prune-webhook-failures && node --test`

**Step 5: Deploy script**
- Create script similar to `deploy-sellapp-webhook.mjs`:
  - functionId: `prune-webhook-failures`
  - runtime: `node-20.0`
  - schedule: `0 3 * * *` (daily at 03:00 UTC) or similar
  - variables:
    - `APPWRITE_*` + `APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID`

**Step 6: Commit**
```bash
git add functions/prune-webhook-failures scripts/appwrite/deploy-prune-webhook-failures.mjs
git commit -m "feat(appwrite): add scheduled webhook failure pruning"
```

---

### Task 4: Add replay script

**Files:**
- Create: `scripts/appwrite/replay-webhook-failure.mjs`

**Step 1: Implement CLI**
- Args: `--env-file`, `--failure-id`, optional `--url`
- Fetch failure doc via REST
- Recompute signature and POST to Worker URL

**Step 2: Manual verification**
1. Trigger a failure (webhook for unknown user).
2. Confirm failure doc exists.
3. Create user, then run:
   - `node scripts/appwrite/replay-webhook-failure.mjs --env-file .env.appwrite --failure-id <id>`

**Step 3: Commit**
```bash
git add scripts/appwrite/replay-webhook-failure.mjs
git commit -m "feat(appwrite): add webhook failure replay script"
```

---

### Task 5: Repo verification + roadmap update

**Files:**
- Modify: `docs/roadmap.md`

**Step 1: Run verification**
Run:
- `pnpm -w typecheck`
- `pnpm -w build`
- `cd functions/sellapp-webhook && node --test`
- `cd functions/prune-webhook-failures && node --test`

**Step 2: Update roadmap**
- Mark Phase 1 “Observability + failure capture for webhook processing” as complete with date `2026-02-14`.

**Step 3: Commit**
```bash
git add docs/roadmap.md
git commit -m "docs(roadmap): complete phase 1 observability"
```

