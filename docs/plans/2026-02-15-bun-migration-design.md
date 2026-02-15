# Bun Toolchain Migration Design

**Date:** 2026-02-15

## Decision

We will migrate the monorepo from pnpm + Node to **Bun**:

- Dependency installation: `bun install` (lockfile: `bun.lockb`)
- Script execution: `bun run ...` with `--bun` in CI/Docker to ensure Node shims resolve to Bun
- Docker/prod runtime: Bun base images (`oven/bun:1-alpine`)
- Keep Turbo as the task runner (invoked via Bun)

## Goals

- Single toolchain: Bun is the package manager and JS runtime used locally and in production.
- Reproducible installs: enforce `bun install --frozen-lockfile` in Docker (and CI later).
- Minimal behavior change: keep existing Turbo task graph and per-package scripts.

## Non-Goals

- Re-architect Turbo pipelines or add CI in this change.
- Change application behavior or feature scope beyond toolchain migration.

## Key Changes

- Add `workspaces` to root `package.json` (Bun reads workspaces from here).
- Remove pnpm workspace/lock artifacts (`pnpm-workspace.yaml`, `pnpm-lock.yaml`).
- Generate and commit `bun.lockb`.
- Update Dockerfiles to:
  - use `oven/bun:1-alpine`
  - run `bun install --frozen-lockfile`
  - run builds with `bun run --bun ...`
  - run services with `bun ...` instead of `node ...`
- Update docs and agent instructions to use Bun commands.

## Risks / Mitigations

- **Runtime compatibility** (Next.js, Turbo, TypeScript) under Bun:
  - Mitigation: require `bun run typecheck` and `bun run build` to pass before considering migration done.

