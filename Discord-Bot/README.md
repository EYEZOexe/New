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
QUEUE_WAKE_FALLBACK_MIN_MS=250
QUEUE_WAKE_FALLBACK_MAX_MS=1000
ROLE_SYNC_CLAIM_LIMIT=5
MIRROR_CLAIM_LIMIT=10
SEAT_AUDIT_CLAIM_LIMIT=3
SEAT_AUDIT_POLL_INTERVAL_MS=30000
```

Notes:
- `ROLE_SYNC_BOT_TOKEN` must match the same value configured in Convex backend env.
- `MIRROR_BOT_TOKEN` is optional. If omitted in both Convex and bot env, the worker falls back to `ROLE_SYNC_BOT_TOKEN` for mirror queue auth.
- `SEAT_AUDIT_POLL_INTERVAL_MS` controls how often the seat-audit worker checks for scheduled seat refresh jobs.
- Bot account needs `Manage Roles` permission in the customer guild.
- Bot account needs message send/edit/delete permissions in target mirror channels.
- Bot role must be above all customer tier roles in Discord role hierarchy.
- Tier-to-role mapping (`basic` / `advanced` / `pro`) can be configured globally in admin UI (`/discord-bot`) and per server via server config (`tenantKey + connectorId + guildId`).
- Channel mirroring is configured per connector in admin (`/mappings/:tenant/:connector`) by enabling forwarding and creating source->target mappings.

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
- Mirrored signal format: embed for signal text + non-image attachments, with multi-image attachments posted as sequential raw image messages for better Discord image rendering.
- Bot additionally claims `discordSeatAudit:claimPendingSeatAuditJobs` to maintain per-server seat snapshots used by mirror claim gating.
