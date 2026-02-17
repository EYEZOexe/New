# Admin Workspace Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the `admin` app into a unified sidebar-based workspace (`Mappings`, `Discord Bot`, `Shop`) while preserving all existing functionality and Convex behavior.

**Architecture:** Introduce an App Router workspace route group with one shared shell and standardized page composition primitives, then migrate existing screens into domain routes (`/mappings`, `/discord-bot`, `/shop/*`). Keep Convex query/mutation contracts unchanged, extract repeated UI chrome into shared components, and add route redirects for legacy paths to avoid breakage.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Convex React client, Tailwind CSS, shadcn/ui primitives, Bun (`typecheck`, `build`, `bun test`).

---

### Task 1: Add workspace route config and active-nav helpers

**Files:**
- Create: `admin/lib/adminRoutes.ts`
- Create: `admin/tests/adminRoutes.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test";
import { getAdminNavState } from "../lib/adminRoutes";

describe("admin route navigation", () => {
  it("marks mappings route active", () => {
    const state = getAdminNavState("/mappings");
    expect(state.activeItem).toBe("mappings");
  });

  it("marks shop group active for nested routes", () => {
    const state = getAdminNavState("/shop/catalog");
    expect(state.activeGroup).toBe("shop");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: FAIL (`Cannot find module '../lib/adminRoutes'`).

**Step 3: Write minimal implementation**

Implement typed route metadata and `getAdminNavState(pathname)` with deterministic prefix matching for:
- `/mappings`
- `/discord-bot`
- `/shop/*`

**Step 4: Run test to verify it passes**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/lib/adminRoutes.ts admin/tests/adminRoutes.test.ts
git commit -m "feat(admin): add typed workspace route config and active nav helpers"
```

### Task 2: Build reusable admin shell and shared page primitives

**Files:**
- Create: `admin/components/admin/admin-shell.tsx`
- Create: `admin/components/admin/admin-sidebar.tsx`
- Create: `admin/components/admin/admin-mobile-nav.tsx`
- Create: `admin/components/admin/admin-page-header.tsx`
- Create: `admin/components/admin/admin-section-card.tsx`
- Create: `admin/components/admin/admin-table-shell.tsx`
- Modify: `admin/app/globals.css`

**Step 1: Write a failing render test for shared shell behavior**

```ts
import { describe, expect, it } from "bun:test";
import { getAdminNavState } from "../lib/adminRoutes";

describe("workspace shell contracts", () => {
  it("supports mobile drawer and desktop sidebar routes", () => {
    const mappings = getAdminNavState("/mappings");
    const discord = getAdminNavState("/discord-bot");
    expect(mappings.activeItem).toBe("mappings");
    expect(discord.activeItem).toBe("discord-bot");
  });
});
```

**Step 2: Run test to verify baseline still passes/fails as expected**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: PASS for existing route helper test coverage.

**Step 3: Implement shell and primitives**

Implement:
- desktop fixed sidebar + mobile drawer trigger
- shared content container and sticky header slot
- standardized section/table wrappers
- CSS tokens/utilities for consistent spacing and hierarchy

**Step 4: Run typecheck**

Run: `cd admin && bun run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/components/admin/admin-shell.tsx admin/components/admin/admin-sidebar.tsx admin/components/admin/admin-mobile-nav.tsx admin/components/admin/admin-page-header.tsx admin/components/admin/admin-section-card.tsx admin/components/admin/admin-table-shell.tsx admin/app/globals.css
git commit -m "feat(admin): add shared workspace shell and page composition primitives"
```

### Task 3: Create workspace route group and move mappings list to `/mappings`

**Files:**
- Create: `admin/app/(workspace)/layout.tsx`
- Create: `admin/app/(workspace)/mappings/page.tsx`
- Modify: `admin/app/page.tsx`
- Modify: `admin/app/connectors/page.tsx`

**Step 1: Write failing test for root path behavior**

```ts
import { describe, expect, it } from "bun:test";
import { getAdminNavState } from "../lib/adminRoutes";

describe("root routing behavior", () => {
  it("treats root as mappings landing target", () => {
    const state = getAdminNavState("/mappings");
    expect(state.activeItem).toBe("mappings");
  });
});
```

**Step 2: Run test**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: PASS (route helper remains consistent).

**Step 3: Implement route migration**

Implement:
- `(workspace)` layout wrapping mapped pages in `AdminShell`
- new `/mappings` page using connector list functionality
- `/` redirect to `/mappings`
- keep `/connectors` as redirect compatibility entry

**Step 4: Run typecheck + build**

Run:
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/app/(workspace)/layout.tsx admin/app/(workspace)/mappings/page.tsx admin/app/page.tsx admin/app/connectors/page.tsx
git commit -m "refactor(admin): move connector list into mappings workspace route"
```

### Task 4: Migrate connector detail to `/mappings/[tenantKey]/[connectorId]`

**Files:**
- Create: `admin/app/(workspace)/mappings/[tenantKey]/[connectorId]/page.tsx`
- Modify: `admin/app/connectors/[tenantKey]/[connectorId]/page.tsx`
- Create: `admin/components/mappings/connector-workspace.tsx`

**Step 1: Write failing route utility test for detail path**

```ts
import { describe, expect, it } from "bun:test";
import { getAdminNavState } from "../lib/adminRoutes";

describe("detail routing", () => {
  it("keeps mappings nav active for connector detail", () => {
    const state = getAdminNavState("/mappings/t1/conn_01");
    expect(state.activeItem).toBe("mappings");
  });
});
```

**Step 2: Run tests**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: PASS after nav helper supports nested mappings route.

**Step 3: Implement detail migration**

Implement:
- shared `ConnectorWorkspace` component containing current detail functionality
- new canonical route under `/mappings/...`
- legacy `/connectors/[tenantKey]/[connectorId]` redirect
- preserve all existing actions and logs (token rotate, status, forwarding, source/mapping CRUD)

**Step 4: Run typecheck + build**

Run:
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/app/(workspace)/mappings/[tenantKey]/[connectorId]/page.tsx admin/app/connectors/[tenantKey]/[connectorId]/page.tsx admin/components/mappings/connector-workspace.tsx
git commit -m "refactor(admin): migrate connector detail into mappings domain workspace"
```

### Task 5: Migrate Discord role config to `/discord-bot`

**Files:**
- Create: `admin/app/(workspace)/discord-bot/page.tsx`
- Modify: `admin/app/discord/page.tsx`
- Create: `admin/components/discord-bot/role-config-panel.tsx`

**Step 1: Write failing test for discord-bot nav state**

```ts
import { describe, expect, it } from "bun:test";
import { getAdminNavState } from "../lib/adminRoutes";

describe("discord bot route", () => {
  it("marks discord-bot active", () => {
    const state = getAdminNavState("/discord-bot");
    expect(state.activeItem).toBe("discord-bot");
  });
});
```

**Step 2: Run tests**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: PASS.

**Step 3: Implement migration**

Implement:
- new `/discord-bot` page in workspace shell
- extract existing role config content into shared domain component
- legacy `/discord` redirect to `/discord-bot`
- keep save/clear/runtime logs with normalized prefix `[admin/discord-bot]`

**Step 4: Run typecheck + build**

Run:
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/app/(workspace)/discord-bot/page.tsx admin/app/discord/page.tsx admin/components/discord-bot/role-config-panel.tsx
git commit -m "refactor(admin): migrate discord role operations to discord-bot route"
```

### Task 6: Migrate shop routes and group catalog/policies/customers under `/shop/*`

**Files:**
- Create: `admin/app/(workspace)/shop/catalog/page.tsx`
- Create: `admin/app/(workspace)/shop/policies/page.tsx`
- Create: `admin/app/(workspace)/shop/customers/page.tsx`
- Modify: `admin/app/payments/catalog/page.tsx`
- Modify: `admin/app/payments/policies/page.tsx`
- Modify: `admin/app/payments/customers/page.tsx`

**Step 1: Write failing route helper test for shop grouping**

```ts
import { describe, expect, it } from "bun:test";
import { getAdminNavState } from "../lib/adminRoutes";

describe("shop grouping", () => {
  it("marks shop group active for policies route", () => {
    const state = getAdminNavState("/shop/policies");
    expect(state.activeGroup).toBe("shop");
  });
});
```

**Step 2: Run tests**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: PASS.

**Step 3: Implement migration**

Implement:
- canonical shop routes under `/shop/*`
- reuse current catalog/policies/customers domain functionality
- keep legacy `/payments/*` as redirects
- normalize logs to `[admin/shop]`

**Step 4: Run typecheck + build**

Run:
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/app/(workspace)/shop/catalog/page.tsx admin/app/(workspace)/shop/policies/page.tsx admin/app/(workspace)/shop/customers/page.tsx admin/app/payments/catalog/page.tsx admin/app/payments/policies/page.tsx admin/app/payments/customers/page.tsx
git commit -m "refactor(admin): consolidate payments surfaces under shop route group"
```

### Task 7: Standardize page headers/actions and remove duplicate chrome

**Files:**
- Modify: `admin/app/(workspace)/mappings/page.tsx`
- Modify: `admin/app/(workspace)/mappings/[tenantKey]/[connectorId]/page.tsx`
- Modify: `admin/app/(workspace)/discord-bot/page.tsx`
- Modify: `admin/app/(workspace)/shop/catalog/page.tsx`
- Modify: `admin/app/(workspace)/shop/policies/page.tsx`
- Modify: `admin/app/(workspace)/shop/customers/page.tsx`
- Modify: `admin/components/admin/admin-page-header.tsx`
- Modify: `admin/components/admin/admin-table-shell.tsx`

**Step 1: Write failing test for breadcrumb behavior**

```ts
import { describe, expect, it } from "bun:test";
import { buildAdminBreadcrumbs } from "../lib/adminRoutes";

describe("breadcrumbs", () => {
  it("builds connector detail breadcrumb", () => {
    const crumbs = buildAdminBreadcrumbs("/mappings/t1/conn_01");
    expect(crumbs.join(" / ")).toBe("Mappings / t1 / conn_01");
  });
});
```

**Step 2: Run tests**

Run: `cd admin && bun test tests/adminRoutes.test.ts`
Expected: FAIL first (missing breadcrumb helper), then PASS after helper is added.

**Step 3: Implement shared header/table usage**

Implement:
- page-level conversion to shared `AdminPageHeader` and `AdminTableShell`
- remove repeated top-link clusters from legacy pages
- ensure consistent empty/loading/error handling and action placement

**Step 4: Run verification**

Run:
- `cd admin && bun test tests/adminRoutes.test.ts`
- `cd admin && bun run typecheck`
- `cd admin && bun run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/app/(workspace)/mappings/page.tsx admin/app/(workspace)/mappings/[tenantKey]/[connectorId]/page.tsx admin/app/(workspace)/discord-bot/page.tsx admin/app/(workspace)/shop/catalog/page.tsx admin/app/(workspace)/shop/policies/page.tsx admin/app/(workspace)/shop/customers/page.tsx admin/components/admin/admin-page-header.tsx admin/components/admin/admin-table-shell.tsx admin/lib/adminRoutes.ts admin/tests/adminRoutes.test.ts
git commit -m "refactor(admin): standardize page chrome and shared table/header system"
```

### Task 8: Final verification, roadmap sync, and docs linkage

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `docs/plans/2026-02-17-admin-workspace-refactor-design.md` (only if implementation differs)

**Step 1: Run full verification**

Run:
- `cd admin && bun test tests/adminRoutes.test.ts`
- `cd admin && bun run typecheck`
- `cd admin && bun run build`

Expected: PASS for all commands.

**Step 2: Manual smoke checklist**

Validate:
- `/mappings` connector list + open detail
- connector token rotate and status/mirroring toggles
- source/mapping add/remove and dashboard visibility controls
- `/discord-bot` save/clear tier mappings
- `/shop/catalog`, `/shop/policies`, `/shop/customers` workflows
- legacy redirects from `/connectors`, `/discord`, `/payments/*`

**Step 3: Update roadmap status**

Add dated completion notes and links to:
- `docs/plans/2026-02-17-admin-workspace-refactor-design.md`
- `docs/plans/2026-02-17-admin-workspace-refactor-plan.md`

**Step 4: Commit**

```bash
git add docs/roadmap.md docs/plans/2026-02-17-admin-workspace-refactor-design.md docs/plans/2026-02-17-admin-workspace-refactor-plan.md
git commit -m "docs: record admin workspace refactor design and implementation plan"
```

