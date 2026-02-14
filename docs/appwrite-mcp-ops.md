# Appwrite Ops Via MCP

This repo prefers running Appwrite operational/admin workflows via an Appwrite MCP server (instead of local scripts/SDK usage).

Runtime behavior is unchanged:
- `apps/web` server-side uses direct Appwrite REST calls (see `apps/web/lib/appwrite-server.ts`).
- Browser code uses the Appwrite Web SDK wrapper (see `packages/appwrite`).

## Prereqs

You will need:
- Appwrite `endpoint` (e.g. `https://<your-appwrite-host>/v1`)
- Appwrite `projectId`
- Appwrite `apiKey` (server/admin key)

Optional (repo defaults shown):
- `APPWRITE_TEAM_PAID_ID` (default `paid`)
- `APPWRITE_TEAM_ADMINS_ID` (default `admins`)

## Verify MCP Is Available

1. Check your Codex MCP configuration (example path from this dev setup):
   - `C:\Users\NAT20\.codex\config.toml`
2. In your editor/agent UI, confirm the Appwrite MCP server is connected and exposes tools.

### MCP Tool Names (Fill In Once Confirmed)

This repo intentionally does not hardcode MCP tool names because MCP servers can vary by deployment.

Populate this table once you confirm the server you are using:

| Workflow | MCP server | Tool name(s) |
|---|---|---|
| Bootstrap (provision DB/collections/indexes/teams) | `<appwrite-mcp>` | `<tool>` |
| Deploy Function (`sellapp-webhook`) | `<appwrite-mcp>` | `<tool>` |
| List users / lookup by email | `<appwrite-mcp>` | `<tool>` |
| List team memberships / grant paid | `<appwrite-mcp>` | `<tool>` |
| Inspect subscription documents | `<appwrite-mcp>` | `<tool>` |

## Workflows

### 1) Bootstrap / Provisioning

Goal: create/update required Appwrite resources (database, collections, attributes, indexes, teams).

Use MCP to perform the equivalent operations described in `scripts/appwrite/bootstrap.mjs`:
- create database
- create collections
- create attributes
- create indexes
- create teams (`paid`, `admins`)

Notes:
- Keep this idempotent: re-running should converge on desired state.
- Avoid deleting resources automatically unless you are on a disposable dev project.

### 2) Deploy Sell.app Webhook Function

Goal: deploy/update the Appwrite Function `sellapp-webhook`.

Use MCP to perform the equivalent operations described in `scripts/appwrite/deploy-sellapp-webhook.mjs`:
- create/update function
- set runtime
- set entrypoint/command as needed
- set environment variables
- deploy/activate

Function code lives in `functions/sellapp-webhook`.

### 3) Common Admin Tasks

Examples:
- Look up a user by email
- Verify team membership for a user
- Add/remove a user from the `paid` team
- Inspect a user's `subscriptions` document

Use the MCP server's user/team/database tools to perform these without running local SDK code.

## Fallback (Deprecated): Local Scripts

If MCP is unavailable or missing a required capability, use these scripts as a fallback.

They are considered deprecated for day-to-day operations:
- Bootstrap: `node scripts/appwrite/bootstrap.mjs` (or `pnpm appwrite:bootstrap`)
- Deploy: `node scripts/appwrite/deploy-sellapp-webhook.mjs --env-file .env.appwrite` (or `pnpm appwrite:deploy:sellapp-webhook`)

