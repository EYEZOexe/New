# Discord (Vencord) -> Convex Ingest + Realtime Signals (Design)

**Date:** 2026-02-16

## Goal

Recreate the legacy Vencord "ChannelScraper" plugin behavior while moving ingestion to the new Convex backend with:

- realtime updates to the website dashboard and admin UI (no polling in UI)
- lowest latency practical (target p95 < 100ms end-to-end for signal appearance in UI)
- operational safety (idempotency, backpressure, retries)

## Non-Goals (Phase 1)

- Paid access gating / subscription enforcement (Phase 2)
- Bot mirroring to customer guild (Phase 4)
- Attachment storage off-Discord (Phase 5)
- In-app admin authentication/authorization
  - Admin panel is gated externally (VPN/Access/Coolify/etc). No admin users are created.

## High-Level Architecture

1. Vencord plugin observes Discord client events (message/thread + periodic channel/guild snapshot).
2. Plugin sends HTTP requests to Convex **HTTP actions**:
   - runtime-config (ETag/304) to determine sources/mappings
   - message-batch ingest to write signals
   - channel/guild snapshot ingest to populate discovery tables for the admin UI
   - thread ingest to store thread metadata
3. Convex writes normalized docs into tables (`signals`, `threads`, config + discovery tables).
4. `website/` dashboard and `admin/` UI subscribe via Convex `useQuery` for realtime updates.

## Security Model (Simplified)

Replace legacy HMAC signing with a single shared secret per connector:

- Client sends: `Authorization: Bearer <connectorToken>`
- Server stores: `tokenHash = sha256(connectorToken)` (never store plaintext)
- Server validates:
  - token hash matches an active connector
  - `tenantKey` + `connectorId` in the request match the connector record

Notes:

- Admin UI calls Convex mutations directly without auth, relying on external gating.
- Connector token is only for plugin ingestion endpoints.

## Realtime / Latency Model

- UI uses Convex subscriptions (`useQuery`) so updates propagate immediately after mutations commit.
- Ingest endpoint processes message batches using a single mutation call per request to reduce overhead.
- Plugin keeps an outbox + retry, but reduces flush interval (e.g. 250ms) and caps batch size (e.g. 100).

## Data Model (Convex)

Existing table:

- `signals` (currently keyed by `sourceMessageId`, indexed by `createdAt`)

Phase 1 additions/changes:

### Connectors + Runtime Config

- `connectors`
  - `tenantKey: string`
  - `connectorId: string`
  - `tokenHash: string`
  - `status: "active" | "paused"`
  - `configVersion: number`
  - `updatedAt: number`
  - `lastSeenAt: number`
  - Indexes:
    - unique-like: `by_tenant_connectorId (tenantKey, connectorId)`
    - `by_tokenHash (tokenHash)` (to authenticate quickly)

- `connectorSources`
  - `tenantKey: string`
  - `connectorId: string`
  - `guildId: string`
  - `channelId: string`
  - `threadMode?: "include" | "exclude" | "only"`
  - `isEnabled: boolean`
  - `updatedAt: number`
  - Indexes:
    - `by_tenant_connector (tenantKey, connectorId)`
    - `by_tenant_connector_channel (tenantKey, connectorId, channelId)`

- `connectorMappings`
  - `tenantKey: string`
  - `connectorId: string`
  - `sourceChannelId: string`
  - `targetChannelId: string`
  - `filtersJson?: object`
  - `transformJson?: object`
  - `priority?: number`
  - `updatedAt: number`
  - Indexes:
    - `by_tenant_connector (tenantKey, connectorId)`
    - `by_tenant_connector_source (tenantKey, connectorId, sourceChannelId)`

### Discovery (Populated By Plugin Snapshot)

- `discordGuilds`
  - `tenantKey, connectorId, guildId, name, updatedAt`
  - Index: `by_tenant_connector_guildId (tenantKey, connectorId, guildId)`

- `discordChannels`
  - `tenantKey, connectorId, channelId, guildId, name, type?, parentId?, position?, updatedAt`
  - Indexes:
    - `by_tenant_connector_channelId (tenantKey, connectorId, channelId)`
    - `by_tenant_connector_guildId (tenantKey, connectorId, guildId)`

### Threads

- `threads`
  - `tenantKey: string`
  - `connectorId: string`
  - `threadId: string`
  - `parentChannelId: string`
  - `guildId: string`
  - `name: string`
  - `archived: boolean`
  - `locked: boolean`
  - `memberCount?: number`
  - `messageCount?: number`
  - `updatedAt: number`
  - `deletedAt?: number`
  - Indexes:
    - `by_tenant_connector_threadId (tenantKey, connectorId, threadId)`
    - `by_tenant_connector_parentChannelId (tenantKey, connectorId, parentChannelId)`

### Signals (Adjustments)

Add:

- `tenantKey: string`
- `connectorId: string`

Keep:

- `sourceMessageId, sourceChannelId, sourceGuildId, content, attachments, createdAt, editedAt, deletedAt`

Indexes:

- `by_sourceMessageId (tenantKey, connectorId, sourceMessageId)` (so idempotency is tenant-safe)
- `by_createdAt (tenantKey, connectorId, createdAt)` (fast recent feed per connector)

## HTTP API (Convex HTTP Actions)

All responses are JSON.

### `GET /connectors/:connectorId/runtime-config?tenant_key=...`

- Auth: `Authorization: Bearer <connectorToken>` (optional, but recommended; without it, config is public)
- Request headers:
  - `If-None-Match: W/"<configVersion>"`
- Response:
  - `304` if unchanged
  - `200` JSON:
    - `{ ok: true, etag, config: { connector_id, tenant_key, status, config_version, ingest_enabled, forward_enabled, sources, mappings } }`

### `POST /ingest/message-batch`

- Auth: `Authorization: Bearer <connectorToken>`
- Body:
  - `{ tenant_key, connector_id, sent_at, batch_id, messages: IngestMessageEvent[] }`
- Behavior:
  - validate connector token + match tenant/connector
  - validate payload shapes (reject malformed events with 400)
  - upsert `signals` idempotently
  - update `connectors.lastSeenAt`
- Response:
  - `200` JSON: `{ ok: true, accepted, deduped, correlation_id }`
  - `401` JSON: `{ ok: false, error_code: "unauthorized", ... }`

### `POST /ingest/channel-guild-sync`

- Auth: `Authorization: Bearer <connectorToken>`
- Body:
  - `{ tenant_key, connector_id, idempotency_key, guilds: [...], channels: [...] }`
- Behavior:
  - upsert `discordGuilds` and `discordChannels` for admin discovery
- Response: same shape as above

### `POST /ingest/thread`

- Auth: `Authorization: Bearer <connectorToken>`
- Body:
  - `{ tenant_key, connector_id, idempotency_key, event_type, thread, member_delta? }`
- Behavior:
  - upsert `threads` for create/update/members_update
  - mark `deletedAt` for delete

## Convex Functions (Queries/Mutations)

Public queries used by UI:

- `signals.listRecent({ tenantKey, connectorId, limit })`
- `connectors.list()`
- `connectors.get({ tenantKey, connectorId })`
- `connectors.runtimeConfig({ tenantKey, connectorId })`
- `discovery.listGuilds({ tenantKey, connectorId })`
- `discovery.listChannels({ tenantKey, connectorId, guildId? })`

Mutations used by admin UI:

- `connectors.createOrRotateToken(...)` (returns plaintext token once)
- `connectors.setStatus(...)`
- `connectors.upsertSource(...)` / `connectors.removeSource(...)`
- `connectors.upsertMapping(...)` / `connectors.removeMapping(...)`

All config mutations increment `connectors.configVersion`.

## Admin UI (No In-App Auth)

Admin app provides:

- connector list + last seen + status + config version
- connector detail editor
  - sources editor (guild/channel selection)
  - mappings editor (source->target channel)
  - token rotate button (shows token once)
- discovery views backed by `discordGuilds` / `discordChannels`
- optional live `signals` panel (Convex query subscription)

## Reliability

- Plugin maintains an outbox with retries and exponential backoff.
- Server enforces idempotency via `signals.by_sourceMessageId` (create dedupe; update patches).
- All endpoints return consistent error shapes so the plugin can decide retry vs drop.

## Verification Strategy (When Implemented)

- Manual:
  - `curl` runtime-config endpoint with/without `If-None-Match` expecting `200/304`
  - `curl` message-batch endpoint expecting accepted/deduped counts
  - Confirm `website` and `admin` UIs update in realtime when a new signal is ingested
- Automated (best-effort in repo):
  - Typecheck/build for `website` and `admin` (`bun run typecheck`, `bun run build`)

