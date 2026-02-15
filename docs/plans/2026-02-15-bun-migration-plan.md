# Bun Toolchain Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace pnpm + Node with Bun for installs, scripts, and Docker runtime across the monorepo.

**Architecture:** Bun manages dependencies and runs scripts; Turbo remains the task runner. Docker images use `oven/bun:1-alpine` and run `bun install --frozen-lockfile` plus `bun run --bun ...` to ensure scripts use Bun’s runtime.

**Tech Stack:** Bun, Turbo, Next.js, TypeScript.

---

### Task 1: Make Bun Workspaces Canonical

**Files:**
- Modify: `package.json`
- Delete: `pnpm-workspace.yaml`

**Step 1: Add workspaces to root `package.json`**

Add:
```json
"workspaces": ["apps/*", "packages/*"]
```

**Step 2: Remove pnpm workspace file**

```bash
git rm pnpm-workspace.yaml
```

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore(bun): define workspaces in package.json"
```

---

### Task 2: Switch Lockfile From pnpm To Bun

**Files:**
- Delete: `pnpm-lock.yaml`
- Create: `bun.lockb`

**Step 1: Remove pnpm lockfile**

```bash
git rm pnpm-lock.yaml
```

**Step 2: Clean install and generate `bun.lockb`**

Run:
```bash
rm -rf node_modules
bun install
```

Expected: `bun.lockb` created.

**Step 3: Verify**

Run:
```bash
bun run typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add bun.lockb
git commit -m "chore(bun): generate bun.lockb"
```

---

### Task 3: Update Docs/Agent Instructions To Bun

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

**Step 1: Update README prereqs and commands**

Replace pnpm instructions with:
- `bun install`
- `bun run dev`
- per-app examples using `bun run --filter ... dev`

**Step 2: Update AGENTS verification commands**

Replace:
- `pnpm -w typecheck` -> `bun run typecheck`
- `pnpm -w build` -> `bun run build`

**Step 3: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: switch repo commands to Bun"
```

---

### Task 4: Switch Dockerfiles To Bun Runtime

**Files:**
- Modify: `Dockerfile.web`
- Modify: `Dockerfile.admin`
- Modify: `Dockerfile.bot`
- Modify: `apps/web/Dockerfile`
- Modify: `apps/admin/Dockerfile`
- Modify: `apps/bot/Dockerfile`

**Step 1: Replace base images**

Change `node:20-alpine` + `corepack enable` to `oven/bun:1-alpine`.

**Step 2: Install deps**

In deps stage:
- copy `package.json`, `bun.lockb`, `turbo.json`, `tsconfig.base.json`, plus needed workspace `package.json` files
- run:
```bash
bun install --frozen-lockfile
```

**Step 3: Build**

Use Bun to run builds:
- Web: `bun run --bun --filter @g3netic/web build`
- Admin: `bun run --bun --filter @g3netic/admin build`
- Bot: `bun run --bun --filter @g3netic/bot build`

**Step 4: Run**

Replace `node ...` with `bun ...` in CMDs.

**Step 5: Verify**

Run:
```bash
bun run typecheck
bun run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add Dockerfile.web Dockerfile.admin Dockerfile.bot apps/web/Dockerfile apps/admin/Dockerfile apps/bot/Dockerfile
git commit -m "chore(docker): run services and builds on Bun"
```

---

### Task 5: Roadmap Hygiene

**Files:**
- Modify: `docs/roadmap.md`

**Step 1: Update blockers/risks**

Add a note about Bun runtime compatibility being a risk if it becomes flaky in production.

**Step 2: Link plan/design**

Add links to these docs in the roadmap links section if desired.

**Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: note Bun toolchain migration"
```

