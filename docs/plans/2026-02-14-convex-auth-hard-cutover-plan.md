# Convex Auth Hard Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cut over `apps/web` and `apps/admin` from Appwrite to Convex as the single backend, using Convex Auth (email + password), starting fresh.

**Architecture:** A single Convex backend lives at repo root (`convex/`). Next.js apps (`apps/web`, `apps/admin`) use Convex React + Convex Auth for client-side auth and data access. Legacy Appwrite code paths are removed or stubbed so there is no split-brain backend.

**Tech Stack:** Convex (self-hosted), Convex Auth (`@convex-dev/auth`), Next.js 15 (App Router), React 19, pnpm workspaces, turbo.

---

### Task 1: Add Convex + Convex Auth Dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/package.json`
- Modify: `apps/admin/package.json`

**Step 1: Add backend deps at workspace root**

Run:
```bash
pnpm add -w convex @convex-dev/auth
```

Expected: `package.json` updated and lockfile changes.

**Step 2: Add frontend deps for each Next app**

Run:
```bash
pnpm --filter @g3netic/web add convex @convex-dev/auth
pnpm --filter @g3netic/admin add convex @convex-dev/auth
```

Expected: app `package.json` files updated and lockfile changes.

**Step 3: Typecheck**

Run:
```bash
pnpm -w typecheck
```

Expected: PASS (no code changes yet; if it fails, fix unrelated baseline issues before continuing).

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml apps/web/package.json apps/admin/package.json
git commit -m "chore: add Convex and Convex Auth deps"
```

---

### Task 2: Initialize Convex At Repo Root

**Files:**
- Create: `convex/` (directory)
- Create: `convex/tsconfig.json` (if created by CLI)
- Create: `convex/_generated/*`
- Create: `convex.json` and other Convex config files (as created by CLI)

**Step 1: Initialize Convex (interactive)**

Run:
```bash
pnpm dlx convex init
```

Expected: Convex config files are created and a `convex/` directory exists.

Notes:
- Self-hosted Convex may require manual configuration after init. Do not commit secrets.
- If `convex init` does not generate types, run `pnpm dlx convex dev` once to generate `convex/_generated/*`.

**Step 2: Verify generated types exist**

Check:
```bash
ls convex/_generated
```

Expected: files like `api.d.ts`, `server.d.ts`, `dataModel.d.ts` (exact filenames may vary).

**Step 3: Commit Convex bootstrap**

```bash
git add convex.json convex convex/_generated
git commit -m "chore: initialize Convex project"
```

---

### Task 3: Define Schema And Auth Backend

**Files:**
- Create: `convex/auth.ts`
- Create: `convex/schema.ts`
- Create: `convex/users.ts`

**Step 1: Create `convex/auth.ts` (password provider)**

Create `convex/auth.ts`:
```ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
```

**Step 2: Create `convex/schema.ts`**

Create `convex/schema.ts`:
```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  subscriptions: defineTable({
    userId: v.id("users"),
    status: v.string(), // "active" | "inactive" | ...
    plan: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),
});
```

**Step 3: Create viewer query in `convex/users.ts`**

Create `convex/users.ts`:
```ts
import { query } from "convex/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    return {
      userId,
      email: (user as any).email ?? null,
      name: (user as any).name ?? null,
      subscription: sub
        ? { status: sub.status, plan: sub.plan ?? null, updatedAt: sub.updatedAt }
        : null,
    };
  },
});

export const setSubscriptionStatus = query({
  args: { status: v.string() },
  handler: async () => {
    // Placeholder so the file compiles if we want a mutation later.
    return { ok: true };
  },
});
```

Note: `authTables` defines the `users` table shape; we treat `email`/`name` as best-effort fields for UI.

**Step 4: Run typecheck**

Run:
```bash
pnpm -w typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add convex/auth.ts convex/schema.ts convex/users.ts
git commit -m "feat(convex): add auth + subscriptions schema and viewer query"
```

---

### Task 4: Enable Next.js To Import Repo-Root `convex/_generated/*`

**Files:**
- Modify: `apps/web/next.config.js`
- Modify: `apps/admin/next.config.js`

**Step 1: Allow importing from outside the app directory**

In `apps/web/next.config.js`, set:
```js
const nextConfig = {
  experimental: { externalDir: true },
};
```

In `apps/admin/next.config.js`, set:
```js
const nextConfig = {
  experimental: { externalDir: true },
};
```

Preserve existing `NEXT_OUTPUT` logic.

**Step 2: Typecheck + build**

Run:
```bash
pnpm -w typecheck
pnpm -w build
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/web/next.config.js apps/admin/next.config.js
git commit -m "chore(next): allow importing Convex generated code from repo root"
```

---

### Task 5: Wire Convex Auth Provider Into `apps/web` And Replace Appwrite Login/Signup

**Files:**
- Create: `apps/web/app/ConvexProviders.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/signup/page.tsx`
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/dashboard/DashboardClient.tsx`
- Delete: `apps/web/app/api/auth/login/route.ts`
- Delete: `apps/web/app/api/auth/signup/route.ts`
- Delete: `apps/web/app/api/auth/logout/route.ts`
- Delete: `apps/web/app/api/auth/debug/route.ts`
- Delete: `apps/web/app/api/appwrite/ping/route.ts`
- Delete: `apps/web/lib/appwrite-*.ts` (all Appwrite wrappers)
- Modify: `apps/web/lib/auth.ts`
- Modify: `apps/web/.env.example`

**Step 1: Create client provider wrapper**

Create `apps/web/app/ConvexProviders.tsx`:
```tsx
"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexProviders({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
```

**Step 2: Wrap `apps/web` layout**

In `apps/web/app/layout.tsx`, wrap `<body>` contents with `<ConvexProviders>`.

**Step 3: Replace login/signup pages to call Convex Auth actions**

Update `apps/web/app/login/page.tsx` to:
- use `useAuthActions()` from `@convex-dev/auth/react`
- call `signIn("password", formData)` with `flow=signIn`

Update `apps/web/app/signup/page.tsx` similarly but with `flow=signUp`.

Expected UX: on success, navigate to `/dashboard`.

**Step 4: Replace server-side Appwrite auth context**

Rewrite `apps/web/lib/auth.ts` to stop importing Appwrite. Keep a minimal shape:
- Remove `getAuthContext()` or replace it with Convex client-side queries only.

**Step 5: Make dashboard page client-gated**

Replace `apps/web/app/dashboard/page.tsx` to:
- be a client component
- use `useQuery` for `viewer`
- show unauthenticated state with a link to `/login`
- show authenticated state and the “paid” placeholder based on `subscription.status === "active"`

**Step 6: Remove Appwrite ping + logout implementation**

Update `apps/web/app/dashboard/DashboardClient.tsx`:
- remove “Ping Appwrite”
- call `signOut()` from `useAuthActions()` on logout

**Step 7: Remove/disable legacy API routes and libs**

Delete:
- `apps/web/app/api/auth/login/route.ts`
- `apps/web/app/api/auth/signup/route.ts`
- `apps/web/app/api/auth/logout/route.ts`
- `apps/web/app/api/auth/debug/route.ts`
- `apps/web/app/api/appwrite/ping/route.ts`
- all `apps/web/lib/appwrite-*.ts` wrappers

**Step 8: Update env example**

In `apps/web/.env.example`:
- remove Appwrite env vars
- add `NEXT_PUBLIC_CONVEX_URL=__SET_IN_COOLIFY__`

**Step 9: Typecheck + build**

Run:
```bash
pnpm -w typecheck
pnpm -w build
```

Expected: PASS.

**Step 10: Commit**

```bash
git add apps/web
git commit -m "feat(web): cut over auth to Convex Auth"
```

---

### Task 6: Stub Discord Linking Routes (Until Convex Migration Task)

**Files:**
- Modify: `apps/web/app/dashboard/DiscordLinkClient.tsx`
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/api/auth/discord/start/route.ts`
- Modify: `apps/web/app/api/auth/discord/callback/route.ts`
- Modify: `apps/web/app/api/auth/discord/complete/route.ts`
- Modify: `apps/web/app/api/auth/discord/unlink/route.ts`

**Step 1: Hide Discord section in dashboard**

In `apps/web/app/dashboard/page.tsx`, remove `DiscordLinkClient` usage (or render a placeholder that says "Coming soon").

**Step 2: Make Discord routes return a consistent "not implemented" error**

In each `apps/web/app/api/auth/discord/*` route, early-return:
```ts
return NextResponse.json({ error: "discord_linking_not_implemented" }, { status: 501 });
```

Expected: no route imports Appwrite code.

**Step 3: Typecheck**

Run:
```bash
pnpm -w typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/web/app/api/auth/discord apps/web/app/dashboard
git commit -m "chore(web): stub discord linking until Convex migration"
```

---

### Task 7: Gate `apps/admin` With Convex Auth + Email Allowlist

**Files:**
- Create: `apps/admin/app/ConvexProviders.tsx`
- Modify: `apps/admin/app/layout.tsx`
- Modify: `apps/admin/app/page.tsx`
- Modify: `apps/admin/.env.example`

**Step 1: Add Convex providers**

Create `apps/admin/app/ConvexProviders.tsx` analogous to `apps/web`.

**Step 2: Wrap admin layout**

Wrap `<body>` with `<ConvexProviders>` in `apps/admin/app/layout.tsx`.

**Step 3: Add allowlist-gated admin home**

Update `apps/admin/app/page.tsx` to be a client component that:
- reads viewer via `useQuery` (same `convex/users.ts` query)
- if unauthenticated, shows link to `/login` (admin app will need its own login page or link out)
- if authenticated but email not in `ADMIN_EMAIL_ALLOWLIST`, shows "Forbidden"
- else show admin placeholder

Note: For now, set allowlist via `process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST` (comma-separated).

**Step 4: Update env example**

In `apps/admin/.env.example`:
- add `NEXT_PUBLIC_CONVEX_URL=__SET_IN_COOLIFY__`
- add `NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST=admin@example.com`

**Step 5: Typecheck + build**

Run:
```bash
pnpm -w typecheck
pnpm -w build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): gate admin with Convex Auth and allowlist"
```

---

### Task 8: Remove Legacy Appwrite Package And Dockerfile References

**Files:**
- Delete: `packages/appwrite/*`
- Modify: `apps/web/package.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/admin/tsconfig.json`
- Modify: `apps/web/Dockerfile`
- Modify: `apps/admin/Dockerfile`
- Modify: `Dockerfile.web`
- Modify: `Dockerfile.admin`
- Modify: `package.json` (remove `appwrite:*` scripts)
- Delete: `scripts/appwrite/*`

**Step 1: Remove workspace dependency references**

Remove `@g3netic/appwrite` from:
- `apps/web/package.json`
- `apps/admin/package.json`

**Step 2: Remove TS path mappings**

Remove the `@g3netic/appwrite` path mapping from:
- `apps/web/tsconfig.json`
- `apps/admin/tsconfig.json`

**Step 3: Remove Dockerfile COPY steps for packages/appwrite**

Update the Dockerfiles to stop copying `packages/appwrite/*` and its `node_modules`.

**Step 4: Delete legacy package + scripts**

```bash
git rm -r packages/appwrite scripts/appwrite
```

Remove `appwrite:*` scripts from root `package.json`.

**Step 5: Typecheck + build**

Run:
```bash
pnpm -w typecheck
pnpm -w build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web apps/admin Dockerfile.web Dockerfile.admin apps/web/Dockerfile apps/admin/Dockerfile package.json pnpm-lock.yaml
git commit -m "chore: remove legacy Appwrite package and build references"
```

---

### Task 9: Roadmap Hygiene Update

**Files:**
- Modify: `docs/roadmap.md`

**Step 1: Mark Phase 0 Convex init complete (if done)**

Update the Phase 0 checklist item "Convex project initialized for this repo" to checked with completion date.

**Step 2: Update Current Status**

Update Now/Next/Blockers to reflect:
- Convex Auth hard cutover completed
- Discord linking and payments are now explicitly pending Convex-native work

**Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: update roadmap for Convex Auth cutover"
```

