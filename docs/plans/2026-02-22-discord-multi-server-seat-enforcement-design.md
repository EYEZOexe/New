# Discord Multi-Server Seat Enforcement Design

**Date:** 2026-02-22

## Context

The current system already supports:

- Per-connector source/target channel mappings for signal mirroring.
- Tier role mapping for role sync (`basic` / `advanced` / `pro`).
- Fast mirror worker flow that targets low latency.

Current gaps:

- Tier role mapping is globally keyed by tier and not scoped to each server/connector pair.
- There is no seat-license enforcement for mirrored signal access.
- The mirror queue can claim jobs without validating server-level commercial limits.

The feature goal is to support bot usage across many customer servers with operator-managed server config and hard seat enforcement that does not add send-path latency.

## Confirmed Decisions

- Keep canonical backend tiers as `basic` / `advanced` / `pro`; admin can label these as bronze/silver/gold.
- Server config scope: `tenantKey + connectorId + guildId`.
- Seat model: unique non-bot members who can view any mapped signal target channel in the guild.
- Enforcement mode: hard stop all mirroring for that server when over limit.
- Runtime strategy: hybrid snapshot gate + opportunistic refresh.
- Priority objective: preserve mirror send performance target (`<100ms`).

## Context7 Findings Applied

Sources reviewed:

- Discord.js Guide (`/discordjs/guide`) for sharding/intents patterns.
- Discord.js 14.25.1 API docs (`/websites/discord_js_packages_discord_js_14_25_1`) for permissions and member fetch behavior.

Design implications:

- Keep gateway intents minimal to reduce event volume.
- Use shard-ready worker architecture for multi-guild scale.
- Use `permissionsFor(memberOrRole)` semantics when resolving channel visibility.
- Avoid expensive per-message member scans on mirror execution path.
- Use bounded concurrent/paginated member evaluation in background jobs.

## Architecture

### 1) Data Domains

Add three new Convex domains:

1. `discordServerConfigs`
- Key: `tenantKey`, `connectorId`, `guildId`.
- Fields: `seatLimit`, `seatEnforcementEnabled`, tier role IDs (`basicRoleId`, `advancedRoleId`, `proRoleId`), metadata timestamps.

2. `discordServerSeatSnapshots`
- Key: `tenantKey`, `connectorId`, `guildId`.
- Fields: `seatsUsed`, `seatLimit`, `isOverLimit`, `checkedAt`, `nextCheckAfter`, `status` (`fresh|stale|expired`), `lastError`.

3. `discordSeatAuditJobs`
- Queue records for server seat recomputation.
- Fields mirror existing queue conventions (`status`, `runAfter`, retry metadata, claim token).

### 2) Workers

Split responsibilities:

- Mirror worker: unchanged send/edit/delete responsibilities.
- Role-sync worker: unchanged role grant/revoke responsibilities.
- New seat-audit worker:
  - Claims seat audit jobs.
  - Computes visible-member union for mapped target channels.
  - Writes snapshots and logs.

### 3) Mirror Queue Gate

`mirror:claimPendingSignalMirrorJobs` adds a server-seat gate:

- Resolve target server key (`tenantKey`, `connectorId`, `guildId`).
- Read latest snapshot.
- Gate outcomes:
  - Under limit + fresh enough snapshot: claim as usual.
  - Over limit: keep job pending; set `lastError=seat_limit_exceeded`.
  - Snapshot missing/stale: keep pending with `lastError=seat_check_pending`, enqueue/accelerate seat-audit job.

This keeps heavy work out of mirror execution and preserves send-path latency.

## Data Flow

1. Admin configures server seat settings and tier role IDs per server.
2. Seat-audit worker periodically recomputes seat usage (plus on-demand refresh requests from claim gate).
3. Snapshot table is continuously updated.
4. Mirror claim reads snapshot and enforces hard-stop rules.
5. Mirror send/edit/delete continues untouched when claim succeeds.

## Seat Counting Semantics

Definition:

- Count unique non-bot members that can view at least one mapped target signal channel in the guild.
- A member visible in multiple mapped channels counts once.

Implementation notes:

- Enumerate mapped target channels for the specific server.
- Resolve member visibility using channel permission semantics.
- Use paginated member collection and bounded concurrency to avoid API bursts.
- Cache short-lived intermediate computations during a single audit execution only.

## Error Handling

Seat audit failures:

- Transient API failure/rate-limit: retry with backoff and jitter; preserve previous snapshot until expiry window.
- Missing guild/channel/permissions: set `lastError` and move snapshot status toward `expired`.

Claim behavior on uncertain state:

- If snapshot is missing/expired, prefer safety and pause mirror claim (`seat_check_pending`) until refreshed.
- If snapshot is stale but recently healthy, permit short grace mode only if explicitly configured (default strict pause for hard-stop guarantee).

## Admin UX Changes

### Discord Bot page

- Add server-scoped panel:
  - Select connector + guild.
  - Set `seatLimit`.
  - Toggle `seatEnforcementEnabled`.
  - Set tier role IDs (`basic/advanced/pro` fields with bronze/silver/gold labels).
- Show live seat snapshot:
  - Used vs limit.
  - Freshness status.
  - Last checked and last error.

### Mappings connector page

- Keep mapping management where it is.
- Add server-seat status badges per guild and shortcut to seat config panel.

## Observability

Add backend and bot logs:

- `[seat-audit]` success/failure with server key and usage numbers.
- `[mirror]` claim-block reasons (`seat_limit_exceeded`, `seat_check_pending`).
- `[admin/discord-bot]` config updates and refresh requests.

Suggested metrics:

- Audit success/failure counts.
- Snapshot stale/expired count.
- Mirror jobs blocked by seat.
- Time to recover from over-limit to resumed mirroring.

## Rollout Strategy

1. Deploy schema and admin config surfaces with enforcement disabled by default.
2. Run seat-audit in shadow mode; validate metrics and latency.
3. Enable hard-stop per selected servers.
4. Expand to default-enabled for new servers after stable operations.

## Risks and Mitigations

- Risk: high member-count guilds increase audit cost.
  - Mitigation: paginated scans, concurrency caps, sharding readiness.

- Risk: Discord permission complexity can produce inaccurate counts.
  - Mitigation: rely on canonical channel permission resolution and regression tests for overwrite edge cases.

- Risk: stale snapshots could block mirroring unnecessarily.
  - Mitigation: explicit freshness windows, fast on-demand audit trigger, clear admin visibility.

