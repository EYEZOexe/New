# Convex Adoption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the legacy backend with Convex as the single source of truth for auth, billing access gates, Discord linkage, and signals.

**Architecture:** Convex holds all backend state (documents and indexes) and runs server functions for webhook ingestion and background jobs. `apps/web` uses Convex queries/mutations for the dashboard and admin workflows. `apps/bot` reads from Convex and performs Discord side effects via an outbox/job-queue table.

**Tech Stack:** Convex, Next.js (`apps/web`, `apps/admin`), Node/TS (`apps/bot`), pnpm workspaces.

---

### Task 1: Create a Convex baseline in-repo

**Files:**
- Create: `convex/schema.ts`
- Create: `convex/webhooks.ts`
- Create: `convex/subscriptions.ts`
- Create: `convex/discord.ts`
- Modify: `package.json`

**Step 1: Add Convex dependency (workspace root)**

Run:

```bash
pnpm add -w convex
```

Expected: `convex` appears in `package.json` and lockfile updates.

**Step 2: Initialize Convex project**

Run:

```bash
pnpm dlx convex init
```

Expected: Convex config files are created and `convex/` exists.

**Step 3: Define minimal schema**

Create `convex/schema.ts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // Stable app-level id (do not use email as the id).
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    createdAt: v.string()
  }).index("by_userId", ["userId"]).index("by_email", ["email"]),

  subscriptions: defineTable({
    userId: v.string(),
    status: v.string(), // "active" | "canceled" | "refunded" | ...
    plan: v.optional(v.string()),
    updatedAt: v.string()
  }).index("by_userId", ["userId"]),

  webhookEvents: defineTable({
    provider: v.string(), // "sellapp"
    eventId: v.string(),
    receivedAt: v.string(),
    processedAt: v.optional(v.string()),
    ok: v.optional(v.boolean()),
    error: v.optional(v.string()),
    payloadJson: v.string()
  }).index("by_eventId", ["provider", "eventId"]),

  webhookFailures: defineTable({
    provider: v.string(),
    eventId: v.string(),
    createdAt: v.string(),
    lastAttemptAt: v.optional(v.string()),
    attempts: v.number(),
    error: v.string()
  }).index("by_eventId", ["provider", "eventId"]),

  discordLinks: defineTable({
    userId: v.string(),
    discordUserId: v.string(),
    linkedAt: v.string()
  }).index("by_userId", ["userId"]).index("by_discordUserId", ["discordUserId"]),

  roleSyncJobs: defineTable({
    userId: v.string(),
    discordUserId: v.optional(v.string()),
    guildId: v.string(),
    desiredRoleIdsJson: v.string(),
    status: v.string(), // "pending" | "processing" | "done" | "failed"
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.string(),
    lastAttemptAt: v.optional(v.string())
  }).index("by_status", ["status", "createdAt"])
});
```

**Step 4: Typecheck**

Run:

```bash
pnpm -w typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml convex/schema.ts
git commit -m "feat: initialize Convex schema baseline"
```

### Task 2: Implement webhook ingestion with idempotency and failure capture

**Files:**
- Create: `convex/webhooks.ts`
- Modify: `functions/sellapp-webhook/src/index.js`
- Modify: `functions/sellapp-webhook/src/process-webhook.js`
- Test: `functions/sellapp-webhook/src/process-webhook.test.js`

**Step 1: Write failing test for idempotency**

In `functions/sellapp-webhook/src/process-webhook.test.js`, add a test that calls the handler twice with the same event ID and asserts the second call does not create duplicate subscription updates.

Expected: FAIL until Convex-backed idempotency exists.

**Step 2: Add Convex mutation stub for event upsert**

Create `convex/webhooks.ts`:

```ts
import { mutation } from "convex/server";
import { v } from "convex/values";

export const upsertWebhookEvent = mutation({
  args: {
    provider: v.string(),
    eventId: v.string(),
    receivedAt: v.string(),
    payloadJson: v.string()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_eventId", (q) => q.eq("provider", args.provider).eq("eventId", args.eventId))
      .unique();

    if (existing) return { created: false, id: existing._id };

    const id = await ctx.db.insert("webhookEvents", {
      provider: args.provider,
      eventId: args.eventId,
      receivedAt: args.receivedAt,
      payloadJson: args.payloadJson
    });

    return { created: true, id };
  }
});
```

**Step 3: Wire sell.app webhook to Convex**

Update `functions/sellapp-webhook/src/process-webhook.js` to call the Convex mutation early. If the event already exists, return a 2xx response and do not repeat side effects.

**Step 4: Run tests**

Run:

```bash
pnpm --filter sellapp-webhook test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add convex/webhooks.ts functions/sellapp-webhook/src/process-webhook.js functions/sellapp-webhook/src/process-webhook.test.js
git commit -m "feat: webhook idempotency and failure capture in Convex"
```

### Task 3: Move access gating in `apps/web` to Convex

**Files:**
- Modify: `apps/web/lib/auth.ts`
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/dashboard/DashboardClient.tsx`
- Delete: `apps/web/app/api/appwrite/ping/route.ts`
- Modify: `apps/web/.env.example`

**Step 1: Write failing test for paid gate**

Add a unit test that asserts `getAuthContext()` returns `paid: true` for a user with an active subscription in Convex.

Expected: FAIL until Convex queries replace legacy logic.

**Step 2: Replace `getAuthContext()` implementation**

In `apps/web/lib/auth.ts`, replace the membership check with a Convex query that returns the user's subscription status and the derived paid/admin flags.

**Step 3: Remove legacy connectivity ping surface**

Delete `apps/web/app/api/appwrite/ping/route.ts` and remove any UI references that call it.

**Step 4: Typecheck**

Run:

```bash
pnpm -w typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/app/dashboard/page.tsx apps/web/app/dashboard/DashboardClient.tsx apps/web/.env.example
git rm apps/web/app/api/appwrite/ping/route.ts
git commit -m "feat(web): gate dashboard access using Convex"
```

### Task 4: Migrate Discord linking storage to Convex and enqueue role sync jobs

**Files:**
- Modify: `apps/web/app/api/auth/discord/complete/route.ts`
- Create: `convex/discord.ts`
- Modify: `apps/bot/src/index.ts`

**Step 1: Create Convex mutations for Discord linkage and job enqueue**

Create `convex/discord.ts` with mutations:

- `upsertDiscordLink(userId, discordUserId, linkedAt)`
- `enqueueRoleSyncJob(userId, discordUserId, guildId, desiredRoleIdsJson)`

**Step 2: Update Discord complete route to call Convex**

In `apps/web/app/api/auth/discord/complete/route.ts`, after verifying OAuth state and obtaining `discordUserId`, call the Convex mutations instead of writing linkage/job state to the legacy backend.

**Step 3: Update bot to poll Convex job queue**

In `apps/bot/src/index.ts`, replace the legacy DB polling logic for `roleSyncJobs` with a Convex query for pending jobs.

**Step 4: Typecheck**

Run:

```bash
pnpm -w typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add convex/discord.ts apps/web/app/api/auth/discord/complete/route.ts apps/bot/src/index.ts
git commit -m "feat: store Discord link and role sync jobs in Convex"
```

### Task 5: Remove legacy backend packages, scripts, and env surface

**Files:**
- Delete: `packages/appwrite/package.json`
- Delete: `packages/appwrite/src/index.ts`
- Delete: `scripts/appwrite/bootstrap.mjs`
- Delete: `scripts/appwrite/deploy-*.mjs`
- Delete: `scripts/appwrite/e2e-sellapp-webhook.mjs`
- Modify: `package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/admin/tsconfig.json`
- Modify: `apps/web/package.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/bot/package.json`

**Step 1: Remove workspace dependencies**

Remove references to the legacy package from app `package.json` files and from root scripts.

**Step 2: Remove path aliases**

Update `apps/web/tsconfig.json` and `apps/admin/tsconfig.json` to remove path mappings for the legacy package.

**Step 3: Typecheck**

Run:

```bash
pnpm -w typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add package.json apps/web/package.json apps/admin/package.json apps/bot/package.json apps/web/tsconfig.json apps/admin/tsconfig.json
git rm -r packages/appwrite scripts/appwrite
git commit -m "chore: remove legacy backend package and scripts"
```

