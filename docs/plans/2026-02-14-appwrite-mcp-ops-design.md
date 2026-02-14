# Appwrite Ops Via MCP (Design)

Date: 2026-02-14

## Goal

Move Appwrite operational/admin workflows to the Appwrite MCP (instead of local scripts and ad-hoc SDK usage), while keeping runtime app code stable.

## Non-Goals

- Rewriting the runtime Next.js auth/session implementation (keep current REST wrapper).
- Removing `node-appwrite` from the repo entirely (it is still used by `apps/bot` and `functions/sellapp-webhook`).
- Building a new CLI/tooling layer around MCP in this iteration.

## Current State (Repo Observations)

- `apps/web` contains a server-side Appwrite REST wrapper in `apps/web/lib/appwrite-server.ts` and does not import `node-appwrite`, but `apps/web/package.json` still depends on `node-appwrite`.
- Operational scripts exist under `scripts/appwrite/`:
  - `scripts/appwrite/bootstrap.mjs` provisions databases/collections/indexes/etc via REST.
  - `scripts/appwrite/deploy-sellapp-webhook.mjs` deploys an Appwrite Function via REST.
- Server-side Node SDK usage exists in:
  - `apps/bot` (`node-appwrite` for DB access/polling).
  - `functions/sellapp-webhook` (`node-appwrite` inside the Appwrite Function runtime).

## Decision

Approach 1 (recommended): keep runtime as-is; move ops guidance/workflows to MCP; deprecate scripts (do not delete yet).

Rationale:
- Lowest risk to runtime behavior.
- Keeps a fallback path while MCP tool coverage is validated.
- Allows incremental migration without blocking development.

## Target Architecture

### Runtime

- Browser: use Appwrite Web SDK wrappers in `packages/appwrite`.
- Server (Next.js): keep Appwrite REST wrapper in `apps/web/lib/appwrite-server.ts` for:
  - session creation (`/account/sessions/email` cookie extraction)
  - admin checks that require API key
  - minimal, explicit endpoints used by the app

### Ops/Admin (Humans)

- Use the Appwrite MCP for:
  - provisioning/bootstrap tasks
  - function deployments
  - routine inspection/admin operations (users, teams, documents)
- Add repo documentation that defines MCP as the preferred operational path and captures:
  - required inputs (endpoint, project ID, API key)
  - common workflows and expected outputs
  - fallbacks to scripts if MCP coverage is incomplete

## Changes In This Iteration

1. Remove unused `node-appwrite` dependency from `apps/web/package.json`.
2. Add an ops doc that:
   - explains how to run bootstrap/deploy/admin tasks via MCP
   - marks `scripts/appwrite/*.mjs` and root `appwrite:*` package scripts as deprecated fallbacks

## Risks / Open Questions

- MCP availability and tool coverage: the repo's Codex MCP configuration currently points at `MetaMCP`; the actual Appwrite MCP tools need to be confirmed in the environment before we can fully replace workflows.
- Automation/CI: MCP-driven operations may not be suitable for CI; scripts may remain necessary for repeatable automation.

## Success Criteria

- `apps/web` no longer depends on `node-appwrite` and builds/typechecks cleanly.
- Documentation clearly indicates MCP as the default operational path and scripts as fallback.
- No runtime behavior changes in auth/session flows.

