# Discord Linking (Appwrite OAuth, Link-Only) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a link-only Discord OAuth flow via Appwrite (for already-logged-in users), store Discord linkage in `profiles`, and automate customer-guild role assignment via an outbox (`role_sync_jobs`) processed by `apps/bot`.

**Architecture:** `apps/web` owns linking/unlinking and desired-role computation (based on Appwrite `subscriptions.plan` + `discord_role_mappings`). It enqueues idempotent `role_sync_jobs`. `apps/bot` polls jobs and applies roles in Discord via the bot token, updating job status for retries/visibility.

**Tech Stack:** Next.js (apps/web, route handlers), TypeScript, Appwrite REST (server wrapper), node-appwrite (bot DB access), discord.js (bot + Discord REST).

---

### Task 1: Create A Dedicated Git Worktree For Implementation

**Files:**
- Modify: none

**Step 1: Create a worktree**

Run:
```powershell
cd "f:\Github Projects\New"
git fetch
git worktree add "..\\New-discord-linking" -b feat/discord-linking-phase2
```

Expected: `f:\Github Projects\New-discord-linking` exists on branch `feat/discord-linking-phase2`.

**Step 2: Confirm clean status in the worktree**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git status -sb
```

Expected: clean worktree.

---

### Task 2: Extend Appwrite Bootstrap For Phase 2 Collections

**Files:**
- Modify: `scripts/appwrite/bootstrap.mjs`

**Step 1: Add new collection IDs to defaults/env reading**

Update `scripts/appwrite/bootstrap.mjs` to include new defaults + env overrides:
- `discord_role_mappings`
- `role_sync_jobs`

Expected: running bootstrap prints:
- `APPWRITE_DISCORD_ROLE_MAPPINGS_COLLECTION_ID=discord_role_mappings`
- `APPWRITE_ROLE_SYNC_JOBS_COLLECTION_ID=role_sync_jobs`

**Step 2: Add `discord_role_mappings` collection**

In `scripts/appwrite/bootstrap.mjs`, add `ensureCollection` for:
- ID: `discord_role_mappings`
- Name: `Discord Role Mappings`
- `documentSecurity: false`
- Permissions: admin-only (read/create/update/delete = admins team)

**Step 3: Add attributes + indexes**

Add attributes to `discord_role_mappings`:
- `plan` (string, required, size 64)
- `guildId` (string, required, size 64)
- `roleIdsJson` (string, required, size 2048)

Add indexes:
- unique index on `plan` (or `plan+guildId` if you expect multiple guilds).

**Step 4: Add `role_sync_jobs` collection**

Add `ensureCollection` for:
- ID: `role_sync_jobs`
- Name: `Role Sync Jobs`
- `documentSecurity: false`
- Permissions: admin-only

**Step 5: Add attributes + indexes**

Add attributes to `role_sync_jobs`:
- `userId` (string, required, size 64)
- `discordUserId` (string, required false, size 64)
- `guildId` (string, required, size 64)
- `desiredRoleIdsJson` (string, required, size 2048)
- `status` (enum, required, elements `["pending","processing","done","failed"]`)
- `attempts` (integer, required false)
- `lastError` (string, required false, size 2048)
- `lastAttemptAt` (datetime, required false)

Add indexes:
- index on `status`
- index on `userId`

**Step 6: Dry-run bootstrap**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
node scripts/appwrite/bootstrap.mjs --env-file .env.appwrite --dry-run
```

Expected: no exceptions; output includes the two new collection IDs.

**Step 7: Commit**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git add scripts/appwrite/bootstrap.mjs
git commit -m "chore(appwrite): add role mapping + role sync job collections"
```

---

### Task 3: Add Web Env Vars For Phase 2

**Files:**
- Modify: `apps/web/.env.example`
- (Optional) Modify: `apps/bot/.env.example`

**Step 1: Add server-only Appwrite IDs to web env example**

Update `apps/web/.env.example` to add (server-only, not `NEXT_PUBLIC_*`):
- `APPWRITE_DATABASE_ID=crypto`
- `APPWRITE_PROFILES_COLLECTION_ID=profiles`
- `APPWRITE_SUBSCRIPTIONS_COLLECTION_ID=subscriptions`
- `APPWRITE_DISCORD_ROLE_MAPPINGS_COLLECTION_ID=discord_role_mappings`
- `APPWRITE_ROLE_SYNC_JOBS_COLLECTION_ID=role_sync_jobs`
- `CUSTOMER_GUILD_ID=`

**Step 2: Ensure Discord callback uses Appwrite**

Add comment clarifying that Appwrite Discord provider must be enabled and the redirect URI should be:
- `https://appwrite.<domain>/v1/account/sessions/oauth2/callback/discord`

**Step 3: Commit**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git add apps/web/.env.example
git commit -m "docs(web): add env vars for discord linking + role sync"
```

---

### Task 4: Extend `apps/web` Appwrite Server Adapter (TDD)

**Files:**
- Test: `apps/web/lib/appwrite-server.test.ts`
- Modify: `apps/web/lib/appwrite-server.ts`

**Step 1: Add a node test harness for the web lib (failing)**

Create `apps/web/lib/appwrite-server.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";

import { extractCookieValue } from "./appwrite-server";

test("extractCookieValue returns value for a_session cookie", () => {
  const sc = "a_session_proj=SECRET; Path=/; HttpOnly; Secure; SameSite=None";
  assert.equal(extractCookieValue(sc, "a_session"), "SECRET");
});
```

Add to `apps/web/package.json` scripts if missing:
- `"test": "node --test"`

Run:
```powershell
pnpm -C apps/web test
```

Expected: FAIL because `extractCookieValue` is not exported.

**Step 2: Export minimal helpers needed for testing**

In `apps/web/lib/appwrite-server.ts`:
- export `extractCookieValue` (keep implementation unchanged)

Run:
```powershell
pnpm -C apps/web test
```

Expected: PASS.

**Step 3: Add an admin DB adapter for documents**

Add functions on `createAdminAppwriteClient()`:
- `getDocument({ databaseId, collectionId, documentId })`
- `upsertDocumentPut({ databaseId, collectionId, documentId, data })` using `PUT /databases/.../documents/{id}`

Add tests verifying correct headers/method/body by injecting a `fetchImpl` into `createAdminAppwriteClient` (refactor needed):
- `createAdminAppwriteClient({ fetchImpl? })`

Run tests, implement minimal until PASS.

**Step 4: Add session-scope identity helpers**

Add functions on `createSessionAppwriteClient()`:
- `listIdentities()`
- `deleteIdentity(identityId)`

Add tests with a fake `fetchImpl` to verify Cookie header reconstruction is sent.

**Step 5: Add “start discord oauth” helper**

Add a helper (either exported function or on session client):
- `startDiscordOAuth({ success, failure })` which does a `fetch` to:
  - `/account/tokens/oauth2/discord?success=...&failure=...`
  - with `redirect: "manual"`
  - returns `{ location: string }` from the `Location` header

Add a test that:
- uses fake fetch returning status 302 with `Location`.
- asserts returned `location` matches.

**Step 6: Add “create session from oauth token” helper**

Add a function:
- `createTokenSessionToken({ userId, secret })` that calls `/account/sessions/token`
- extracts the `a_session_*` cookie value and returns it

Add tests verifying cookie extraction behavior.

**Step 7: Commit**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git add apps/web/lib/appwrite-server.ts apps/web/lib/appwrite-server.test.ts apps/web/package.json
git commit -m "test+feat(web): extend appwrite server adapter for discord linking"
```

---

### Task 5: Implement Discord Link/Unlink API Routes (TDD)

**Files:**
- Create: `apps/web/app/api/auth/discord/start/route.ts`
- Create: `apps/web/app/api/auth/discord/complete/route.ts`
- Create: `apps/web/app/api/auth/discord/unlink/route.ts`
- Create: `apps/web/lib/discord-linking.ts`
- Test: `apps/web/lib/discord-linking.test.ts`

**Step 1: Add a small pure helper for state handling**

Create `apps/web/lib/discord-linking.ts` with:
- `makeOAuthState()` (random)
- `verifyOAuthState(expected, actual)` (constant-time compare)

Create `apps/web/lib/discord-linking.test.ts` with a failing test for verify behavior.

Run:
```powershell
pnpm -C apps/web test
```

Expected: FAIL then PASS once implemented.

**Step 2: Start route**

Implement `apps/web/app/api/auth/discord/start/route.ts`:
- Require logged-in user via `getAuthContext()` (or equivalent)
- Create state cookie (HttpOnly, short maxAge)
- Call Appwrite helper to get redirect `Location`
- Return `NextResponse.redirect(location)`

Add a minimal test by calling the route handler function directly (mock `cookies()` and the Appwrite helper).

**Step 3: Complete route**

Implement `apps/web/app/api/auth/discord/complete/route.ts`:
- Validate `state` matches cookie; clear cookie
- Validate `userId` matches currently logged-in user id
- Call Appwrite helper to exchange `{ userId, secret }` for session token
- Set the web session cookie to new token
- Call `listIdentities()` and pick discord identity’s `providerUid`
- Upsert `profiles` (doc ID = userId) with `discordUserId` and `discordLinkedAt`
- Enqueue role sync job (Task 6 provides helper)
- Redirect to `/dashboard?linked=1`

**Step 4: Unlink route**

Implement `apps/web/app/api/auth/discord/unlink/route.ts`:
- Require logged-in
- List identities; if no discord identity, return `{ ok: true }` idempotently
- Delete identity
- Update profile fields to null
- Enqueue role sync job with empty desired roles

**Step 5: Commit**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git add apps/web/app/api/auth/discord apps/web/lib/discord-linking.ts apps/web/lib/discord-linking.test.ts
git commit -m "feat(web): add discord link/unlink routes (Appwrite OAuth)"
```

---

### Task 6: Desired Roles Computation + Job Enqueue (Web, TDD)

**Files:**
- Create: `apps/web/lib/role-sync.ts`
- Test: `apps/web/lib/role-sync.test.ts`
- Modify: `apps/web/lib/appwrite-server.ts`

**Step 1: Add role sync pure helpers (failing tests)**

Create `apps/web/lib/role-sync.ts` with pure functions:
- `parseRoleIdsJson(text)` -> string[]
- `computeDesiredRoleIds({ subscriptionStatus, plan, mappingDocs })` -> string[]

Add unit tests covering:
- inactive status -> []
- missing plan mapping -> []
- mapped plan -> role IDs returned

**Step 2: Add admin queries for mapping + subscriptions**

Extend `createAdminAppwriteClient()` to support:
- `getSubscriptionByUserId({ databaseId, subscriptionsCollectionId, userId })`
- `listRoleMappings({ databaseId, roleMappingsCollectionId, guildId })`
- `createOrUpdateRoleSyncJob({ ... })` (idempotent upsert using PUT with documentId = userId)

Write tests with fake fetch verifying request shapes.

**Step 3: Wire job enqueue into complete/unlink**

Update the complete/unlink routes to call:
- load subscription doc
- load mapping docs
- compute desired role ids
- upsert job doc with status `pending`

**Step 4: Commit**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git add apps/web/lib/role-sync.ts apps/web/lib/role-sync.test.ts apps/web/lib/appwrite-server.ts apps/web/app/api/auth/discord
git commit -m "feat(web): enqueue role sync jobs based on subscription plan"
```

---

### Task 7: Add Dashboard UI For Link/Unlink

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`
- Create: `apps/web/app/dashboard/DiscordLinkClient.tsx`

**Step 1: Add a small client component**

Create `apps/web/app/dashboard/DiscordLinkClient.tsx`:
- Renders “Link Discord” button -> POST `/api/auth/discord/start` then follow redirect
- Renders “Unlink Discord” button -> POST `/api/auth/discord/unlink` then refresh

**Step 2: Render component on dashboard**

Update `apps/web/app/dashboard/page.tsx` to render the component for paid users (and optionally for all logged-in users).

**Step 3: Commit**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git add apps/web/app/dashboard/page.tsx apps/web/app/dashboard/DiscordLinkClient.tsx
git commit -m "feat(web): add dashboard discord link/unlink UI"
```

---

### Task 8: Implement Bot Role Sync Worker (TDD Where Practical)

**Files:**
- Create: `apps/bot/src/role-sync.ts`
- Test: `apps/bot/src/role-sync.test.ts`
- Modify: `apps/bot/src/index.ts`
- Modify: `apps/bot/.env.example`

**Step 1: Add env vars**

Update `apps/bot/.env.example` to include:
- `APPWRITE_ROLE_SYNC_JOBS_COLLECTION_ID=role_sync_jobs`
- `CUSTOMER_GUILD_ID=`

**Step 2: Create a pure role diff helper**

Create `apps/bot/src/role-sync.ts`:
- `diffRoles({ desired, current })` (set operations)

Add `apps/bot/src/role-sync.test.ts` to validate add/remove sets.

Run:
```powershell
pnpm -C apps/bot test
```

Expected: you may need to add `"test": "node --test"` to `apps/bot/package.json` for this iteration.

**Step 3: Implement Appwrite job polling + updating**

In `apps/bot/src/index.ts`:
- If required env vars are present, start a loop:
  - list documents in `role_sync_jobs` where `status == "pending"` (limit 25)
  - set status to `processing`
  - apply Discord role changes (Step 4)
  - set status `done` or `failed` with `attempts++` and `lastError`

**Step 4: Apply roles via Discord REST**

Implement minimal Discord REST calls using bot token:
- Add role: `PUT /guilds/{guildId}/members/{userId}/roles/{roleId}`
- Remove role: `DELETE /guilds/{guildId}/members/{userId}/roles/{roleId}`

Treat:
- `404` member not found as non-retryable (failed)
- `429` as retryable (failed but attempts increments; rely on backoff)

**Step 5: Commit**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git add apps/bot/src/index.ts apps/bot/src/role-sync.ts apps/bot/src/role-sync.test.ts apps/bot/.env.example apps/bot/package.json
git commit -m "feat(bot): process role sync jobs and apply discord roles"
```

---

### Task 9: Repo Verification

**Files:**
- Modify: none

**Step 1: Typecheck**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
pnpm -w typecheck
```

Expected: PASS.

**Step 2: Build**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
pnpm -w build
```

Expected: PASS.

**Step 3: Git status**

Run:
```powershell
cd "f:\Github Projects\New-discord-linking"
git status -sb
```

Expected: clean.

---

### Task 10: Roadmap Hygiene

**Files:**
- Modify: `docs/roadmap.md`

After successful end-to-end validation (link + roles applied), update:
- Phase 2 checklist items to `[x]` with completion date.
- Add link to:
  - `docs/plans/2026-02-14-discord-linking-appwrite-oauth-design.md`
  - `docs/plans/2026-02-14-discord-linking-appwrite-oauth-plan.md`

Commit:
```powershell
git add docs/roadmap.md
git commit -m "docs(roadmap): complete phase 2 discord linking"
```

---

Plan complete and saved to `docs/plans/2026-02-14-discord-linking-appwrite-oauth-plan.md`.

Two execution options:

1. Subagent-Driven (this session)
2. Parallel Session (separate)

Which approach?

