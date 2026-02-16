# Discord Role Sync Bot (Bun)

Bun-based worker that consumes Convex `roleSyncJobs` and applies Discord role changes.

## Environment

Create `.env.local` from `.env.example`:

```bash
DISCORD_BOT_TOKEN=__SET_ME__
CONVEX_URL=https://convex-backend.g3netic.com
ROLE_SYNC_BOT_TOKEN=__SET_ME__
MIRROR_BOT_TOKEN=__SET_ME__
DISCORD_BOT_WORKER_ID=discord-worker-1
ROLE_SYNC_POLL_INTERVAL_MS=1000
MIRROR_POLL_INTERVAL_MS=25
ROLE_SYNC_CLAIM_LIMIT=5
MIRROR_CLAIM_LIMIT=10
```

Notes:
- `ROLE_SYNC_BOT_TOKEN` must match the same value configured in Convex backend env.
- `MIRROR_BOT_TOKEN` is optional. If omitted in both Convex and bot env, the worker falls back to `ROLE_SYNC_BOT_TOKEN` for mirror queue auth.
- `MIRROR_POLL_INTERVAL_MS` controls idle mirror queue polling cadence; lower values reduce mirror latency at the cost of more frequent Convex calls.
- Bot account needs `Manage Roles` permission in the customer guild.
- Bot account needs message send/edit/delete permissions in target mirror channels.
- Bot role must be above all customer tier roles in Discord role hierarchy.
- Tier-to-role mapping (`basic` / `advanced` / `pro`) is configured in admin UI (`/discord`) and stored in Convex.
- Channel mirroring is configured per connector in admin (`/connectors/:tenant/:connector`) by enabling forwarding and creating source->target mappings.

## Install + Run

```bash
bun install
bun run typecheck
bun run start
```

For local development:

```bash
bun run dev
```

## Convex Backend Env Required

The Convex backend needs these env vars for role sync queue behavior:

```bash
ROLE_SYNC_BOT_TOKEN=__SET_ME__
MIRROR_BOT_TOKEN=__SET_ME__ # optional; falls back to ROLE_SYNC_BOT_TOKEN when omitted
```

Optional legacy fallback (single role when no tier mapping exists):

```bash
DISCORD_CUSTOMER_GUILD_ID=__SET_ME__
DISCORD_CUSTOMER_ROLE_ID=__SET_ME__
```

## Processing Model

- Bot claims pending jobs from `roleSync:claimPendingRoleSyncJobs`
- Executes Discord role add/remove
- Acknowledges result via `roleSync:completeRoleSyncJob`
- Failed jobs are retried with exponential backoff until max attempts
- Bot also claims `mirror:claimPendingSignalMirrorJobs` to post/edit/delete mirrored signal messages
- Signal mirror queue results are acknowledged via `mirror:completeSignalMirrorJob`
