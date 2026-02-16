# Discord (Vencord) -> Convex Ingest + Realtime Signals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Convex HTTP ingest endpoints + runtime config + realtime `signals` feed, plus an admin UI to manage sources/mappings, and update the Vencord plugin to send to the new Convex backend with low latency.

**Architecture:** Vencord plugin calls Convex HTTP actions (self-hosted under `/http`) using a per-connector Bearer token. HTTP actions validate the token and run Convex mutations to upsert signals, threads, and discovery snapshots. `website/` and `admin/` use Convex subscriptions for realtime updates. Admin auth is out of scope and is handled externally.

**Tech Stack:** Next.js 16, React 19, Bun, Convex (`convex`), Convex Auth (website only), TypeScript.

---

### Task 1: Add Convex Tables For Connectors, Runtime Config, Discovery, Threads

**Files:**
- Modify: `website/convex/schema.ts`

**Step 1: Run typecheck (baseline)**

Run:

```powershell
cd "f:\Github Projects\New\website"
bun run typecheck
```

Expected: PASS (or note existing failures before continuing).

**Step 2: Update schema**

Edit `website/convex/schema.ts` to:

- add `connectors`, `connectorSources`, `connectorMappings`
- add `discordGuilds`, `discordChannels`
- add `threads`
- add `tenantKey` and `connectorId` fields to `signals`
- update indexes to be tenant-safe (`tenantKey` + `connectorId` prefixes)

**Step 3: Push schema to self-hosted Convex**

Run:

```powershell
cd "f:\Github Projects\New\website"
bunx convex dev --once
```

Expected: schema deploy succeeds.

**Step 4: Commit**

Run:

```powershell
git add "website/convex/schema.ts"
git commit -m "feat(convex): add connector config, discovery, threads, and tenant-scoped signals"
```

---

### Task 2: Add Connector Auth Helpers (Token Hashing + Lookup)

**Files:**
- Create: `website/convex/connectorsAuth.ts`
- Test: `website/scripts/smoke/connector-auth.mjs`

**Step 1: Write a failing smoke script**

Create `website/scripts/smoke/connector-auth.mjs`:

```js
// Smoke script. Exits non-zero until connectors/token validation exists.
// Usage:
//   CONNECTOR_TOKEN=... TENANT_KEY=t1 CONNECTOR_ID=conn_01 bun website/scripts/smoke/connector-auth.mjs

const token = process.env.CONNECTOR_TOKEN;
if (!token) throw new Error("Missing CONNECTOR_TOKEN");

console.log("Have token length:", token.length);
process.exit(1);
```

Run:

```powershell
cd "f:\Github Projects\New\website"
bun scripts/smoke/connector-auth.mjs
```

Expected: FAIL (exit code 1).

**Step 2: Add minimal helper module**

Create `website/convex/connectorsAuth.ts` with:

- `sha256Hex(input: string): string` using WebCrypto in Convex runtime
- `getConnectorByTokenHash(ctx, tokenHash)` query helper
- `authenticateConnector(ctx, request)` helper that:
  - parses `Authorization: Bearer ...`
  - computes token hash
  - loads connector
  - checks `status !== "paused"`
  - returns `{ connector, tenantKey, connectorId }` or throws a typed error

**Step 3: Update smoke script to PASS once implemented**

Update `website/scripts/smoke/connector-auth.mjs` to only exit `0` once you can validate a token against a real connector record (after Task 4 introduces connector creation).

**Step 4: Commit**

```powershell
git add "website/convex/connectorsAuth.ts" "website/scripts/smoke/connector-auth.mjs"
git commit -m "feat(convex): add connector bearer-token auth helpers"
```

---

### Task 3: Add Convex Queries/Mutations For Connector Config (Admin UI)

**Files:**
- Create: `website/convex/connectors.ts`
- Create: `website/convex/discovery.ts`

**Step 1: Implement `connectors` queries/mutations**

Create `website/convex/connectors.ts` with:

- Query `listConnectors()`
- Query `getConnector({ tenantKey, connectorId })`
- Mutation `rotateConnectorToken({ tenantKey, connectorId })`:
  - generate token
  - store sha256 hash in connector
  - return plaintext token once
- Mutation `setConnectorStatus({ tenantKey, connectorId, status })`
- Mutation `upsertSource(...)`, `removeSource(...)`
- Mutation `upsertMapping(...)`, `removeMapping(...)`

Rule: any mutation that changes sources/mappings increments `configVersion` and updates `updatedAt`.

**Step 2: Implement discovery queries**

Create `website/convex/discovery.ts` with:

- Query `listGuilds({ tenantKey, connectorId })`
- Query `listChannels({ tenantKey, connectorId, guildId? })`

**Step 3: Quick manual verification**

Use the Convex dashboard data editor to:

- create a connector row
- call `rotateConnectorToken` from the Convex functions UI
- confirm `tokenHash` is stored and `configVersion` increments on changes

**Step 4: Commit**

```powershell
git add "website/convex/connectors.ts" "website/convex/discovery.ts"
git commit -m "feat(convex): add connector config and discovery queries/mutations"
```

---

### Task 4: Add Convex HTTP Actions (Runtime Config + Ingest Endpoints)

**Files:**
- Modify: `website/convex/http.ts`
- Create: `website/convex/httpConnectors.ts`
- Create: `website/convex/httpIngest.ts`
- Create: `website/convex/ingest.ts`

**Step 1: Add ingestion mutations**

Create `website/convex/ingest.ts` with mutations:

- `ingestMessageBatch({ tenantKey, connectorId, messages })`
  - idempotent upsert by `(tenantKey, connectorId, sourceMessageId)`
  - create patches on `update`
- `ingestChannelGuildSync({ tenantKey, connectorId, guilds, channels })`
  - upsert discovery tables
- `ingestThreadEvent({ tenantKey, connectorId, event })`
  - upsert `threads` or mark `deletedAt`

**Step 2: Implement HTTP handlers**

Create `website/convex/httpConnectors.ts`:

- `GET /connectors/:connectorId/runtime-config`
  - authenticate via bearer token
  - read sources/mappings from tables
  - return ETag derived from connector `configVersion`
  - respect `If-None-Match`

Create `website/convex/httpIngest.ts`:

- `POST /ingest/message-batch`
- `POST /ingest/channel-guild-sync`
- `POST /ingest/thread`

All:

- authenticate bearer token
- validate body payloads
- `await ctx.runMutation(...)` once per request
- return consistent JSON error shapes

**Step 3: Wire routes**

Modify `website/convex/http.ts` to register the new routes alongside `auth.addHttpRoutes(http)`.

**Step 4: Manual endpoint verification**

Run:

```powershell
curl -i "https://convex-backend.g3netic.com/http/connectors/conn_01/runtime-config?tenant_key=t1"
```

Expected:

- `401` until you include `Authorization: Bearer ...`
- `200` once token is present and connector exists
- `304` once `If-None-Match` matches current configVersion

**Step 5: Commit**

```powershell
git add "website/convex/http.ts" "website/convex/httpConnectors.ts" "website/convex/httpIngest.ts" "website/convex/ingest.ts"
git commit -m "feat(convex): add http actions for runtime config and ingestion"
```

---

### Task 5: Add Website Dashboard Realtime Signals Feed

**Files:**
- Create: `website/convex/signals.ts`
- Modify: `website/app/dashboard/page.tsx`

**Step 1: Add a `signals.listRecent` query**

Create `website/convex/signals.ts`:

- Query `listRecent({ tenantKey, connectorId, limit })` that reads `signals` by `by_createdAt`.

**Step 2: Render feed in dashboard**

Modify `website/app/dashboard/page.tsx`:

- keep existing auth gating
- add a `useQuery(api.signals.listRecent, ...)` feed under the “You are signed in” header
- render message content + timestamps + channel/guild ids

**Step 3: Verify realtime**

- Ingest a test message (via curl to `/ingest/message-batch`)
- Confirm the dashboard updates without refresh

**Step 4: Commit**

```powershell
git add "website/convex/signals.ts" "website/app/dashboard/page.tsx"
git commit -m "feat(website): show realtime signals feed on dashboard"
```

---

### Task 6: Wire Admin App To Convex (No Auth) And Build Config Editor UI

**Files:**
- Modify: `admin/package.json`
- Modify: `admin/next.config.ts`
- Create: `admin/app/convex/ConvexProvider.tsx`
- Create: `admin/app/connectors/page.tsx`
- Create: `admin/app/connectors/[tenantKey]/[connectorId]/page.tsx`
- Modify: `admin/app/page.tsx`

**Step 1: Add Convex deps**

In `admin/package.json`, add `convex` dependency.

Run:

```powershell
cd "f:\Github Projects\New\admin"
bun install
```

**Step 2: Allow importing generated API from website**

Modify `admin/next.config.ts`:

- enable `experimental.externalDir = true`

This allows importing `website/convex/_generated/api` for typed function refs.

**Step 3: Add Convex provider**

Create `admin/app/convex/ConvexProvider.tsx`:

- reads `NEXT_PUBLIC_CONVEX_URL`
- creates `ConvexReactClient`
- wraps children in `ConvexProvider`

Wire it in `admin/app/layout.tsx` (wrap body contents).

**Step 4: Build UI pages**

- `admin/app/page.tsx`: replace boilerplate with a link to `/connectors`
- `admin/app/connectors/page.tsx`:
  - list connectors
  - show lastSeenAt/status/configVersion
  - link to connector detail
- `admin/app/connectors/[tenantKey]/[connectorId]/page.tsx`:
  - rotate token button (shows token once)
  - sources editor (table + add/remove)
  - mappings editor (table + add/remove)
  - discovery pickers (guild/channel names from snapshot tables)

**Step 5: Commit**

```powershell
git add "admin"
git commit -m "feat(admin): add connector config editor backed by Convex"
```

---

### Task 7: Update Vencord Plugin To Use Convex HTTP Actions + Bearer Token

**Files:**
- Modify: `Legacy-Discord-Plugin/contracts.ts`
- Modify: `Legacy-Discord-Plugin/index.tsx`
- Modify: `Legacy-Discord-Plugin/native.ts`

**Step 1: Simplify transport config**

Update `Legacy-Discord-Plugin/contracts.ts`:

- remove `connectorKeyId` and `connectorSecret`
- add `connectorToken`
- keep `ingestBaseUrl`, `tenantKey`, `connectorId`, `requestTimeoutMs`, `maxBatchSize`

**Step 2: Update native request code**

In `Legacy-Discord-Plugin/native.ts`:

- remove signature/nonce/timestamp logic
- set header: `Authorization: Bearer ${connectorToken}`
- keep correlation id header for debugging
- keep retry/backoff/outbox behavior

Update endpoints to point at Convex self-hosted HTTP origin:

- `GET {ingestBaseUrl}/connectors/:connectorId/runtime-config?tenant_key=...`
- `POST {ingestBaseUrl}/ingest/message-batch`
- `POST {ingestBaseUrl}/ingest/channel-guild-sync`
- `POST {ingestBaseUrl}/ingest/thread`

**Step 3: Update plugin settings UI**

In `Legacy-Discord-Plugin/index.tsx`:

- rename settings fields accordingly (`connectorToken`)
- update `hasTransportConfig` and `getTransportConfig`
- keep runtime config polling and snapshot loop

**Step 4: Manual verification**

- Install the plugin in Vencord dev environment
- Configure:
  - `ingestBaseUrl = https://convex-backend.g3netic.com/http`
  - `tenantKey`, `connectorId`, `connectorToken` from admin UI
- Send a message in a configured channel and confirm:
  - HTTP `message-batch` returns 200
  - dashboard feed updates in realtime

**Step 5: Commit**

```powershell
git add "Legacy-Discord-Plugin"
git commit -m "feat(plugin): send discord events to Convex http ingest with bearer token"
```

---

### Task 8: Verification And Roadmap Updates

**Files:**
- Modify: `docs/roadmap.md`

**Step 1: Typecheck**

Run:

```powershell
cd "f:\Github Projects\New\website"
bun run typecheck
cd "f:\Github Projects\New\admin"
bun run typecheck
```

Expected: PASS.

**Step 2: Build**

Run:

```powershell
cd "f:\Github Projects\New\website"
bun run build
cd "f:\Github Projects\New\admin"
bun run build
```

Expected: PASS.

**Step 3: Update roadmap (Phase 1)**

In `docs/roadmap.md`:

- mark Phase 1 items complete with the completion date
- add link to this plan doc and the design doc
- update Current Status Now/Next/Blockers if it changed

**Step 4: Commit**

```powershell
git add "docs/roadmap.md"
git commit -m "docs: update roadmap for Phase 1 signal pipeline"
```

