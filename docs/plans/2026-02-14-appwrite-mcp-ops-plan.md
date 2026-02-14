# Appwrite Ops Via MCP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove unused `node-appwrite` from `apps/web` and make MCP the documented default for Appwrite operational/admin workflows (with scripts as deprecated fallback).

**Architecture:** Keep runtime Appwrite usage unchanged (Next.js server uses REST wrapper; browser uses Web SDK wrapper). Replace human operational runbooks with an MCP-first workflow doc; keep existing scripts as a fallback until MCP coverage is validated.

**Tech Stack:** pnpm workspaces, Next.js (apps/web), TypeScript, Appwrite, MCP (via Codex MCP servers).

---

### Task 1: Create A Dedicated Git Worktree For Implementation

**Files:**
- Modify: none

**Step 1: Create a worktree**

Run:
```powershell
cd "f:\Github Projects\New"
git fetch
git worktree add "..\\New-appwrite-mcp-ops" -b chore/appwrite-mcp-ops
```

Expected: a new directory `f:\Github Projects\New-appwrite-mcp-ops` exists on branch `chore/appwrite-mcp-ops`.

**Step 2: Confirm clean status in the worktree**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
git status -sb
```

Expected: on `chore/appwrite-mcp-ops`, clean working tree.

**Step 3: Commit checkpoint (optional)**

No commit needed.

---

### Task 2: Remove Unused `node-appwrite` From `apps/web`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Write a “dependency is unused” verification**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
rg -n "node-appwrite" apps/web -S --hidden --glob "!**/.next/**"
```

Expected: no runtime imports (only `apps/web/package.json` reference).

**Step 2: Remove dependency from `apps/web/package.json`**

Edit `apps/web/package.json`:
- Remove the `node-appwrite` entry from `dependencies`.

**Step 3: Update lockfile**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
pnpm -w install
```

Expected: `pnpm-lock.yaml` updates; `node-appwrite@14.x` is no longer pulled for `@g3netic/web` (while `node-appwrite@22.x` remains for other packages).

**Step 4: Verify app still typechecks**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
pnpm --filter @g3netic/web typecheck
```

Expected: PASS (exit code 0).

**Step 5: Commit**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): drop unused node-appwrite dependency"
```

---

### Task 3: Create MCP-First Appwrite Ops Runbook

**Files:**
- Create: `docs/appwrite-mcp-ops.md`
- Modify: `README.md`

**Step 1: Draft the doc skeleton**

Create `docs/appwrite-mcp-ops.md` with sections:
- Prereqs (endpoint, project ID, API key, team IDs)
- “How to verify MCP is available” (where in Codex to see MCP tools; what server/tool names are expected)
- Bootstrap workflow (equivalent to `scripts/appwrite/bootstrap.mjs`)
- Deploy `sellapp-webhook` function workflow (equivalent to `scripts/appwrite/deploy-sellapp-webhook.mjs`)
- Common admin workflows (inspect user, list memberships, add/remove `paid` membership, inspect subscription docs)
- Fallback: scripts (deprecated) with links/commands and a clear “use only if MCP is unavailable” note

Note: If exact MCP tool names are not discoverable in-code, include a short “fill-in” section:
- “MCP Tool Names” table with placeholders to be updated after tool discovery.

**Step 2: Link from README**

Modify `README.md`:
- Add a short section under Appwrite setup / operations:
  - “Ops via MCP (recommended)” linking to `docs/appwrite-mcp-ops.md`
  - Mention scripts exist but are deprecated fallback.

**Step 3: Commit**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
git add docs/appwrite-mcp-ops.md README.md
git commit -m "docs: add MCP-first Appwrite ops runbook"
```

---

### Task 4: (Optional) Mark Script Entry Points As Deprecated

**Files:**
- Modify: `scripts/appwrite/bootstrap.mjs`
- Modify: `scripts/appwrite/deploy-sellapp-webhook.mjs`
- Modify: `package.json`

**Step 1: Add deprecation headers to scripts**

Update both scripts to include a short top comment:
- “Deprecated: prefer `docs/appwrite-mcp-ops.md` (MCP).”

**Step 2: Deprecate npm scripts (keep them for fallback)**

Update root `package.json` scripts:
- Keep `appwrite:bootstrap` and `appwrite:deploy:sellapp-webhook` as-is, but add a note in README/runbook that they are fallback-only.

**Step 3: Commit**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
git add scripts/appwrite/bootstrap.mjs scripts/appwrite/deploy-sellapp-webhook.mjs package.json
git commit -m "docs(appwrite): deprecate local scripts in favor of MCP"
```

---

### Task 5: Repo-Level Verification

**Files:**
- Modify: none

**Step 1: Typecheck all workspaces**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
pnpm -w typecheck
```

Expected: PASS.

**Step 2: Build all workspaces (optional)**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
pnpm -w build
```

Expected: PASS.

**Step 3: Final status**

Run:
```powershell
cd "f:\Github Projects\New-appwrite-mcp-ops"
git status -sb
```

Expected: clean worktree.

