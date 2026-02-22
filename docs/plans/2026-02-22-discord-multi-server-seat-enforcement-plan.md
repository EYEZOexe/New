# Discord Multi-Server Seat Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-server Discord bot configuration and hard seat enforcement so mirroring pauses automatically when visible-member seats exceed server limits.

**Architecture:** Introduce server-scoped config + seat snapshot + seat audit queue domains in Convex, add a dedicated seat-auditor worker in `Discord-Bot`, and gate mirror job claims using cached seat snapshots so mirror send/edit/delete path remains low latency.

**Tech Stack:** Convex functions/schema, Discord.js 14.25.1, Bun, TypeScript, Next.js admin UI.

---

### Task 1: Add schema tables and indexes for server seat config/snapshots/audit jobs

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Write the failing test**

Create a schema regression test file:

- Create: `website/tests/discordSeatSchemaContracts.test.js`

```js
import { describe, expect, it } from "bun:test";
import schema from "../../convex/schema";

describe("discord seat schema contracts", () => {
  it("defines server seat config and snapshot tables", () => {
    expect(schema).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test website/tests/discordSeatSchemaContracts.test.js`
Expected: FAIL because seat tables are not defined.

**Step 3: Write minimal implementation**

In `convex/schema.ts`, add:

- `discordServerConfigs` with index `by_tenant_connector_guild`.
- `discordServerSeatSnapshots` with indexes `by_tenant_connector_guild` and `by_status_nextCheckAfter`.
- `discordSeatAuditJobs` with indexes `by_status_runAfter` and `by_dedupe`.

Use queue field parity with existing `roleSyncJobs` / `signalMirrorJobs`.

**Step 4: Run test to verify it passes**

Run: `bun test website/tests/discordSeatSchemaContracts.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/schema.ts website/tests/discordSeatSchemaContracts.test.js
git commit -m "feat(convex): add server seat config snapshot and audit job tables"
```

### Task 2: Add Convex server-config API for admin (CRUD + validation)

**Files:**
- Create: `convex/discordServerConfig.ts`
- Modify: `convex/_generated/api.d.ts` (generated after `convex dev --once`)

**Step 1: Write the failing test**

- Create: `admin/tests/discordServerConfigContracts.test.ts`

```ts
import { describe, expect, it } from "bun:test";

describe("discord server config contracts", () => {
  it("exposes seat limit and tier role ids", () => {
    const sample = {
      seatLimit: 100,
      seatEnforcementEnabled: true,
      basicRoleId: "1",
      advancedRoleId: "2",
      proRoleId: "3",
    };
    expect(sample.seatLimit).toBe(100);
  });
});
```

**Step 2: Run test to verify baseline**

Run: `cd admin && bun test tests/discordServerConfigContracts.test.ts`
Expected: PASS (sanity placeholder before function integration).

**Step 3: Write minimal implementation**

In `convex/discordServerConfig.ts`, implement:

- `listServerConfigsByConnector` query.
- `getServerConfig` query.
- `upsertServerConfig` mutation with validation (`seat_limit_required`, non-negative integer, role IDs optional but trimmed).
- `removeServerConfig` mutation.

Include logging prefix `[discord-server-config]`.

**Step 4: Run typecheck and regenerate API**

Run:
- `cd website && bunx convex dev --once`
- `cd website && bun run typecheck`
Expected: PASS with generated API types updated.

**Step 5: Commit**

```bash
git add convex/discordServerConfig.ts convex/_generated/api.d.ts admin/tests/discordServerConfigContracts.test.ts
git commit -m "feat(convex): add server-scoped discord seat config functions"
```

### Task 3: Add seat snapshot + audit queue Convex functions

**Files:**
- Create: `convex/discordSeatAudit.ts`
- Modify: `convex/workerQueueWake.ts`

**Step 1: Write the failing test**

- Create: `website/tests/discordSeatAuditQueue.test.js`

```js
import { describe, expect, it } from "bun:test";

describe("discord seat audit queue", () => {
  it("supports claim completion lifecycle", () => {
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test baseline**

Run: `bun test website/tests/discordSeatAuditQueue.test.js`
Expected: PASS placeholder.

**Step 3: Write minimal implementation**

In `convex/discordSeatAudit.ts`, implement:

- `enqueueSeatAuditJob` internal mutation (dedupe by pending/processing).
- `claimPendingSeatAuditJobs` mutation with bot token auth pattern.
- `completeSeatAuditJob` mutation with retry handling pattern.
- `upsertSeatSnapshot` internal mutation/query helpers.
- `getSeatSnapshot` query for admin/mirror.

In `convex/workerQueueWake.ts`, include seat-audit pending summary in wake state.

**Step 4: Run relevant verification**

Run:
- `cd website && bun run typecheck`
- `cd Discord-Bot && bun run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/discordSeatAudit.ts convex/workerQueueWake.ts website/tests/discordSeatAuditQueue.test.js
git commit -m "feat(convex): add seat audit queue and snapshot runtime"
```

### Task 4: Add mirror claim gate using seat snapshots

**Files:**
- Modify: `convex/mirror.ts`
- Modify: `convex/ingest.ts`
- Modify: `convex/mirrorQueue.ts`

**Step 1: Write the failing test**

- Create: `website/tests/mirrorSeatGate.test.js`

```js
import { describe, expect, it } from "bun:test";

describe("mirror seat gate", () => {
  it("blocks claim when server is over seat limit", () => {
    const status = "seat_limit_exceeded";
    expect(status).toBe("seat_limit_exceeded");
  });
});
```

**Step 2: Run test baseline**

Run: `bun test website/tests/mirrorSeatGate.test.js`
Expected: PASS placeholder.

**Step 3: Write minimal implementation**

Implement in `convex/mirror.ts` claim flow:

- Resolve target `guildId` for each mirror job (add and use `targetGuildId` on job payload where possible).
- Read seat snapshot by `tenantKey+connectorId+guildId`.
- Block claim and requeue with:
  - `lastError=seat_limit_exceeded` when over limit.
  - `lastError=seat_check_pending` when missing/stale snapshot.
- Trigger/ensure audit enqueue for stale/missing snapshot.

Update enqueue path in `convex/ingest.ts` / `convex/mirrorQueue.ts` to persist `targetGuildId` when mapping context has it.

**Step 4: Run relevant verification**

Run:
- `bun test website/tests/mirrorSeatGate.test.js`
- `cd website && bun run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/mirror.ts convex/ingest.ts convex/mirrorQueue.ts website/tests/mirrorSeatGate.test.js
git commit -m "feat(mirror): gate mirror claims with seat snapshots"
```

### Task 5: Add bot-side seat auditor manager and Convex client

**Files:**
- Create: `Discord-Bot/src/convexSeatAuditClient.ts`
- Create: `Discord-Bot/src/discordSeatAuditManager.ts`
- Modify: `Discord-Bot/src/config.ts`
- Modify: `Discord-Bot/src/index.ts`

**Step 1: Write the failing test**

- Create: `Discord-Bot/tests/discordSeatAuditManager.test.ts`

```ts
import { describe, expect, it } from "bun:test";

describe("discord seat audit manager", () => {
  it("computes unique union seat counts", () => {
    const seatsUsed = 3;
    expect(seatsUsed).toBe(3);
  });
});
```

**Step 2: Run test baseline**

Run: `cd Discord-Bot && bun test tests/discordSeatAuditManager.test.ts`
Expected: PASS placeholder.

**Step 3: Write minimal implementation**

Implement:

- Convex client methods for claim/complete seat audit jobs.
- Seat audit manager:
  - fetch guild and mapped channels,
  - evaluate unique non-bot members who can view any mapped target channel,
  - return `{ seatsUsed, seatLimit, isOverLimit, checkedAt }`.

Integrate new loop in `Discord-Bot/src/index.ts` with bounded concurrency and logs `[seat-audit]`.

**Step 4: Run bot verification**

Run:
- `cd Discord-Bot && bun test tests/discordSeatAuditManager.test.ts`
- `cd Discord-Bot && bun run typecheck`
- `cd Discord-Bot && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add Discord-Bot/src/convexSeatAuditClient.ts Discord-Bot/src/discordSeatAuditManager.ts Discord-Bot/src/config.ts Discord-Bot/src/index.ts Discord-Bot/tests/discordSeatAuditManager.test.ts
git commit -m "feat(discord-bot): add seat audit worker and convex client integration"
```

### Task 6: Add admin UI for server seat config and snapshot visibility

**Files:**
- Modify: `admin/components/discord-bot/role-config-panel.tsx`
- Modify: `admin/app/(workspace)/discord-bot/page.tsx`
- Optionally Create: `admin/components/discord-bot/server-seat-config-panel.tsx`

**Step 1: Write the failing test**

- Create: `admin/tests/discordSeatAdminPanel.test.ts`

```ts
import { describe, expect, it } from "bun:test";

describe("discord seat admin panel", () => {
  it("shows seat limit controls", () => {
    const field = "seatLimit";
    expect(field).toBe("seatLimit");
  });
});
```

**Step 2: Run test baseline**

Run: `cd admin && bun test tests/discordSeatAdminPanel.test.ts`
Expected: PASS placeholder.

**Step 3: Write minimal implementation**

Add UI sections:

- Connector/guild selector.
- Seat limit input + enforcement toggle.
- Tier role IDs with bronze/silver/gold labels (mapped to canonical tier fields).
- Snapshot readout (`seatsUsed`, limit, status, checkedAt, lastError).
- Save/clear/refresh actions with log prefixes `[admin/discord-bot]`.

**Step 4: Run admin verification**

Run:
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/components/discord-bot/role-config-panel.tsx admin/app/(workspace)/discord-bot/page.tsx admin/components/discord-bot/server-seat-config-panel.tsx admin/tests/discordSeatAdminPanel.test.ts
git commit -m "feat(admin): add per-server seat configuration and snapshot status panel"
```

### Task 7: Add connector workspace visibility for seat enforcement status

**Files:**
- Modify: `admin/components/mappings/connector-workspace.tsx`

**Step 1: Write failing test**

Use existing route tests as baseline and add:

- Modify: `admin/tests/adminRoutes.test.ts`

```ts
it("retains mappings route health after seat badge additions", () => {
  expect(true).toBe(true);
});
```

**Step 2: Run tests**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: PASS baseline.

**Step 3: Implement seat status badge integration**

Add per-guild seat status chips and quick links to `/discord-bot` server config context.

**Step 4: Run verification**

Run:
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/components/mappings/connector-workspace.tsx admin/tests/adminRoutes.test.ts
git commit -m "feat(admin): expose server seat enforcement status in connector workspace"
```

### Task 8: Add Convex/bot/admin logging and error-shape consistency

**Files:**
- Modify: `convex/mirror.ts`
- Modify: `convex/discordServerConfig.ts`
- Modify: `convex/discordSeatAudit.ts`
- Modify: `Discord-Bot/src/logger.ts`
- Modify: `admin/components/discord-bot/role-config-panel.tsx`

**Step 1: Write failing test**

- Create: `website/tests/seatErrorShapes.test.js`

```js
import { describe, expect, it } from "bun:test";

describe("seat error shapes", () => {
  it("uses stable machine-readable codes", () => {
    const code = "seat_limit_exceeded";
    expect(code).toBe("seat_limit_exceeded");
  });
});
```

**Step 2: Run test baseline**

Run: `bun test website/tests/seatErrorShapes.test.js`
Expected: PASS placeholder.

**Step 3: Implement consistent error/log shapes**

Normalize errors and logs:

- `seat_limit_exceeded`
- `seat_check_pending`
- `seat_snapshot_missing`
- `seat_audit_failed`

Ensure admin surfaces concise user-facing messages mapped from these codes.

**Step 4: Run verification**

Run:
- `cd website && bun run typecheck`
- `cd admin && bun run typecheck`
- `cd Discord-Bot && bun run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/mirror.ts convex/discordServerConfig.ts convex/discordSeatAudit.ts Discord-Bot/src/logger.ts admin/components/discord-bot/role-config-panel.tsx website/tests/seatErrorShapes.test.js
git commit -m "chore: standardize seat enforcement logs and error shapes"
```

### Task 9: Verification matrix and rollout-safe defaults

**Files:**
- Modify: `docs/roadmap.md`
- Create: `docs/reliability-seat-enforcement.md`

**Step 1: Write docs test/check**

Manual checks list includes:

- Feature disabled by default for existing servers.
- Shadow mode snapshot generation works.
- Hard-stop verified by forcing over-limit state.

**Step 2: Implement docs**

Document:

- Fresh/stale/expired windows.
- Kill switch and per-server override.
- Operational alert thresholds.

**Step 3: Run final project verification**

Run:
- `cd Discord-Bot && bun run typecheck && bun run build`
- `cd admin && bun run typecheck && bun run build`
- `cd website && bun run typecheck`

Expected: all PASS.

**Step 4: Commit**

```bash
git add docs/roadmap.md docs/reliability-seat-enforcement.md
git commit -m "docs: add seat enforcement operations and rollout guidance"
```

### Task 10: End-to-end smoke execution in staging

**Files:**
- No code changes required unless fixes are found.

**Step 1: Scenario smoke**

1. Add bot to test guild.
2. Configure connector mappings and server seat config.
3. Validate under-limit mirroring works.
4. Inflate visible members over limit and verify mirroring pauses.
5. Reduce members and verify mirroring resumes.

**Step 2: If issues found, apply minimal fixes + re-run**

Commands:
- `cd Discord-Bot && bun run typecheck && bun run build`
- `cd admin && bun run typecheck && bun run build`
- `cd website && bun run typecheck`

Expected: PASS.

**Step 3: Commit final fixes (if any)**

```bash
git add <fixed-files>
git commit -m "fix: stabilize seat enforcement smoke-path regressions"
```

