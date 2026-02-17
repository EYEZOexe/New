# Roadmap

Living plan for delivering G3netic Crypto Signals SaaS (web dashboard + customer Discord mirroring + Convex backend).

## Scope / North Star

Capture "signals" from a source Discord guild and deliver them to paying customers via:

- a web dashboard feed (`apps/web`)
- a customer Discord guild where a bot mirrors messages (`apps/bot`)

Backend is Convex.

## Current Status

**Now**
- Completed Phase 5 attachment hardening across ingest, dashboard, and mirror paths: ingest now normalizes/stores Discord attachment references with IDs (`attachmentId`) and URL/type/size sanitization, signal queries expose sanitized attachment refs with backend attachment-count diagnostics, dashboard now enforces safe attachment rendering (type/size-aware image preview limits + blocked executable-type handling) while preserving stable attachment links, and mirror payload attachment contracts are aligned end-to-end. (2026-02-17)
- Closed Phase 4 mirror reliability/observability gaps: Convex mirror completion now distinguishes terminal vs retryable Discord failures (including retry-after aware requeue), stores mirrored extra image message IDs for deterministic cleanup, and admin connector detail now shows mirror latency stats (`create`/`update`/`delete` p95 over last 60m) alongside queue/runtime status to enforce the `<100ms` target. (2026-02-17)
- Upgraded mirror message formatting for customer channels: bot now posts signal content as Discord embeds, includes non-image attachments in embed fields, and posts multi-image attachments as sequential raw image messages below the embed, with extra mirrored message IDs tracked for update/delete cleanup. (2026-02-16)
- Reduced Phase 4 mirror path latency by removing fixed queue waits: Vencord plugin outbox now fast-flushes message events immediately (with async disk persistence) and lowers fallback flush cadence from 250ms to 25ms, while Discord-Bot now runs a dedicated low-latency mirror queue loop (`MIRROR_POLL_INTERVAL_MS`, default 25ms) with immediate drain when work is present and per-job latency logs. (2026-02-16)
- Started Phase 4 mirroring implementation end-to-end: Convex now persists signal mirror queue + message linkage state (`signalMirrorJobs`, `mirroredSignals`), ingest enqueues create/update/delete mirror jobs from admin-configured source->target mappings when connector forwarding is enabled, Discord-Bot worker now claims mirror jobs and posts/edits/deletes messages in target channels, and admin connector config now includes mirroring toggle + bot runtime/queue visibility. (2026-02-16)
- Simplified payments model to fixed-term only (no recurring path): Sell access policies now enforce duration days for product/variant mappings, subscription access is validated against `endsAt`, and dashboard now shows tier + expiration + live time-left countdown from Convex. (2026-02-16)
- Hardened Discord role-sync worker verification to prevent false-positive completes: worker now force-fetches guild member state, validates target role exists, and verifies post-condition after grant/revoke before ACKing `roleSync:completeRoleSyncJob`. (2026-02-16)
- Added Sell billing enforcement for mixed payment models: Convex now supports admin-configured Sell access policies (`/payments/policies`) that map product/variant IDs to tier + billing mode (`recurring` / `fixed_term`), persists entitlement metadata on subscriptions (`tier`, `billingMode`, `variantId`, `endsAt`), and runs scheduled expiry to auto-revoke fixed-term access/roles after duration windows (30/60/90/etc). (2026-02-16)
- Extended Phase 3 to tier-aware Discord role sync: Convex now supports admin-configured `basic`/`advanced`/`pro` product-to-role mappings (`discordTierRoleMappings` + `discordRoleConfig:*` functions), payment and link/unlink flows enqueue grant/revoke jobs against the desired tier role set, and admin has a new `/discord` surface to manage mappings and role-sync runtime status. Legacy env single-role sync remains as fallback when tier mappings are not configured. (2026-02-16)
- Phase 3 role assignment automation is implemented end-to-end: Convex `roleSyncJobs` outbox table + claim/complete queue mutations (`roleSync:claimPendingRoleSyncJobs`, `roleSync:completeRoleSyncJob`) are live, Discord link/unlink and payment subscription transitions enqueue grant/revoke jobs, and a Bun-based worker bot was added in `Discord-Bot` to process jobs against Discord roles with retry/backoff semantics and structured logs. (2026-02-16)
- Fixed dashboard Discord OAuth completion UI state so "Completing link..." no longer gets stuck: callback query cleanup now uses client history replacement and completion state resets reliably after `discord:linkViewerDiscord` success/failure. (2026-02-16)
- Phase 3 Discord OAuth linking is now implemented in `website`: new Next.js auth routes (`/api/auth/discord/start`, `/api/auth/discord/callback`, `/api/auth/discord/complete`) validate OAuth state cookies, exchange code for Discord identity, and dashboard flow persists link/unlink state in Convex (`discord:linkViewerDiscord`, `discord:unlinkViewerDiscord`) with frontend/backend linkage logs. (2026-02-16)
- Added an operator surface in `admin` for payment linkage visibility: `payments:listPaymentCustomers` query and `admin` route `/payments/customers` show Sell customer/subscription mappings, user email/status context, and searchable linkage metadata for support/debugging. (2026-02-16)
- Added durable Sell payment identity tracking in Convex (`paymentCustomers`): webhook processing now resolves users by external subscription/customer IDs before email fallback, and stores provider linkage for subsequent events and operator visibility. (2026-02-16)
- Fixed Sell.app webhook failure persistence semantics in Convex: processing failures now commit `webhookEvents` as `failed` with incrementing attempt counts, and replay increments attempts predictably while keeping failure inbox visibility (`/webhooks/sellapp/failures`). (2026-02-16)
- Phase 2 payments + access gating is live in Convex: Sell.app webhook ingestion (`/webhooks/sellapp`) is idempotent by provider event ID, updates subscription state, records attempt/failure metadata, and exposes controlled replay/failure inbox endpoints (`/webhooks/sellapp/replay`, `/webhooks/sellapp/failures`). Signal feed access is now gated server-side on active subscription status. (2026-02-16)
- Website signup/login is validated end-to-end against self-hosted Convex (`https://convex-backend.g3netic.com`) using domain mapping:
  `convex-backend.g3netic.com` = backend origin, `convex-backend.g3netic.com/http` = auth/OIDC routes, and `convex.g3netic.com` = dashboard origin. (2026-02-16)
- Establish Convex data model and auth strategy for `website`; `admin` does not require customer signup/login.
- Define migration steps and stop adding new backend features to legacy code paths.
- Define and enforce realtime signal delivery targets (p95 < 100ms) across web, admin, and bot.
- Connector discovery bootstrap improved: plugin now sends accessible guild/channel metadata (IDs + names) even before source mappings exist, and admin config filters source channels by selected guild. (2026-02-16)
- Fixed Vencord channel discovery extraction to handle wrapped/nested ChannelStore entries so channel snapshots persist in `discordChannels` for admin selection. (2026-02-16)
- Expanded Vencord channel discovery fallbacks to probe multiple guild-scoped ChannelStore methods and log detected method availability for environment-specific debugging. (2026-02-16)
- Added REST fallback (`/api/v10|v9/guilds/:id/channels`) for channel discovery when ChannelStore-based extraction returns empty in specific Discord client variants. (2026-02-16)
- Hardened REST fallback auth + diagnostics: token lookup now includes Discord webpack `getToken()`, and cookie-auth fallback requests are attempted when token extraction fails. (2026-02-16)
- Added DOM-based fallback channel discovery by parsing visible `/channels/<guild>/<channel>` links when ChannelStore and REST fallbacks still return zero channels in constrained client contexts. (2026-02-16)
- Added dynamic webpack-based channel store discovery to recover no-click channel discovery in builds where `@webpack/common` exposes only `getChannel`. (2026-02-16)
- Refactored admin connector UX: left side now models "Available Channels", and mappings source/target selectors are constrained to enabled available channels instead of all discovered channels. (2026-02-16)
- Added on-demand channel discovery requests from admin ("Fetch channels" per selected guild) and removed periodic plugin snapshot loops to reduce unnecessary discovery traffic. (2026-02-16)
- Added per-available-channel role flags (`Source` / `Target`) in admin config and constrained mapping selectors accordingly (source list from source-enabled channels, target list from target-enabled channels). (2026-02-16)
- Plugin ingestion scope now respects runtime `is_source` and only monitors channels marked as source for message/thread ingestion. (2026-02-16)
- Hardened plugin webpack/token module probing to avoid proxy/i18n side effects and added explicit REST network diagnostics for guild channel fetch failures. (2026-02-16)
- Decoupled discovery requests from config reloads: admin "Fetch channels" now only updates discovery request version, and plugin only reapplies runtime config when `config_version` changes (add/update path). (2026-02-16)
- Fixed thread ingest 400s by aligning Convex thread event validation with emitted plugin fields and hardening plugin thread payload normalization for sparse thread events. (2026-02-16)
- Tightened dynamic webpack channel-store selection to require guild-channel APIs, preventing i18n/proxy collisions that caused zero-channel discovery snapshots. (2026-02-16)
- Simplified discovery flow: plugin now sends guild-only snapshots automatically on startup/runtime sync, and admin channel discovery remains explicit via guild-selected "Fetch channels". (2026-02-16)
- Reduced discovery pickup latency and hardened dynamic store validation to avoid i18n/proxy false-positives during channel discovery probes. (2026-02-16)
- Replaced dynamic token/store probing in plugin discovery with Vencord store-based lookup (`findStoreLazy("AuthenticationStore")`) and stable ChannelStore-only probing to reduce false positives and restore guild-channel REST discovery reliability. (2026-02-16)
- Added guild-object channel extraction fallback (`GuildStore.getGuild`) so channel discovery can still succeed when REST auth is unavailable and dynamic channel-store probing is disabled. (2026-02-16)
- Fixed discovery request replay semantics on plugin restart: stale backend requests are baselined (not replayed), initial guild sync retries until GuildStore is ready, and targeted channel discovery no longer triggers channel-store fallback scans for guild enumeration. (2026-02-16)
- Phase 1 signal pipeline is now hardened end-to-end: message ingest normalizes update/delete timestamps with fallbacks, stale post-delete updates are ignored server-side, plugin emits message delete events, and dashboard feed surfaces edited/deleted state with realtime update logs. (2026-02-16)

**Next**
- Add scheduled payment reconciliation and alerting for webhook drift/failure spikes.

**Blockers / Risks**
- Data migration. We need a clear plan to migrate users/subscriptions/signals into Convex without downtime.
- Auth and identity mapping. We need one stable user identifier across web, bot, and webhook processing.
- Convex Auth configuration. Self-hosted Convex must be configured with signing keys/JWKS and correct site URL, otherwise auth flows will fail at runtime.
- Convex Auth issuer should be HTTPS. The current self-hosted issuer is `http://convex-backend.g3netic.com/http`; align `CONVEX_CLOUD_ORIGIN`/`CONVEX_SITE_ORIGIN` + proxy headers so OIDC metadata uses `https://...` to avoid mixed-scheme issues.
- Convex deployment credentials. We need `CONVEX_SELF_HOSTED_ADMIN_KEY` available in CI/deploy to push schema/functions to self-hosted Convex.
- Discord OAuth app configuration. `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and callback URL registration must stay aligned with deployed `NEXT_PUBLIC_APP_URL` / `DISCORD_REDIRECT_URI`.
- Discord role sync configuration/permissions. `ROLE_SYNC_BOT_TOKEN` must be aligned across Convex + bot env; tier role mappings must be maintained in admin (`/discord`) or legacy fallback env must be set; bot needs `Manage Roles` with hierarchy above all managed customer tier roles.
- Discord mirror permissions/configuration. `MIRROR_BOT_TOKEN` (or `ROLE_SYNC_BOT_TOKEN` fallback) must be aligned across Convex + bot env; connector forwarding must be enabled per connector and source->target mappings maintained in admin; bot needs send/edit/delete permissions in mapped target channels.
- Sell webhook payload variance risk. Some events may omit `variant_id`; maintain product-level fallback policies so fixed-term duration enforcement remains deterministic.
- Some provider webhook variants may omit stable customer/subscription IDs; fallback email matching still exists for those events and should be monitored.
- Bun migration consistency. Build and CI/deploy tooling must stay aligned with Bun lockfiles/workspaces or deployments will fail before app startup.
- Webhook idempotency and retries. We need to guarantee "at least once" delivery does not create duplicate state.
- Performance. Sub-100ms p95 delivery requires careful schema/indexing and realtime subscriptions; polling is not acceptable on the critical path.

## Milestones (Phases)

### Phase 0: Foundations

- [x] Convex project initialized for this repo
  Exit criteria: `apps/web` and backend functions can read/write Convex in dev.
- [x] Cut over website auth to Convex Auth (email + password) (2026-02-15)
  Exit criteria: `website` build includes Convex Auth login/signup and uses `NEXT_PUBLIC_CONVEX_URL`; admin is explicitly out of scope for signup/login.
- [x] Schema defined for core entities (users, subscriptions, signals, discord linkage) (2026-02-15)
  Exit criteria: schema exists with indexes needed for critical queries (`website/convex/schema.ts`).

  ### Phase 1: Signal Pipeline (ingestion -> Convex -> dashboard)

Goal: signals show up in the dashboard quickly and consistently.

- [x] Collector ingestion writes normalized signal docs to Convex (2026-02-16)
  Exit criteria: new messages appear in Convex and are queryable by customer.
- [x] Dashboard feed reads signals and updates near realtime (2026-02-16)
  Exit criteria: paid user sees new signals with p95 end-to-end delivery < 100ms.
- [x] Idempotency + edit/delete semantics defined (2026-02-16)
  Exit criteria: edits/deletes converge correctly across dashboard + bot.

### Phase 2: Payments + Access (Sell.app webhook)

Goal: payments reliably grant/revoke access even if the website is down.

- [x] Webhook ingestion writes events and updates subscription state in Convex (2026-02-16)
  Exit criteria: a test webhook creates an event record, upserts subscription, and updates access gate.
- [x] Failure capture + replay for webhook processing (2026-02-16)
  Exit criteria: failures are recorded with enough context to retry safely.
  Link: `docs/reliability.md`
- [x] Enforce recurring vs fixed-term entitlement lifecycle in Convex (2026-02-16)
  Exit criteria: active subscription access is policy-driven by product/variant mapping, and fixed-term access auto-expires with role revocation via scheduled jobs.
- [x] Move to fixed-term-only subscription windows + dashboard remaining-time visibility (2026-02-16)
  Exit criteria: policies are duration-driven without recurring mode selection, and customer dashboard shows live time left from Convex `endsAt`.

### Phase 3: Discord Linking (customer identity + roles)

Goal: customers can link Discord and get the right role(s) in the customer guild.

- [x] Discord OAuth linking flow stores linkage in Convex (2026-02-16)
  Exit criteria: user can link/unlink; linkage is stored and queryable.
- [x] Role assignment automation via job queue stored in Convex (2026-02-16)
  Exit criteria: paid users get correct role; revoked users lose role.
- [x] Tier-based role mapping configurable in admin (2026-02-16)
  Exit criteria: operator can set tier->guild/role mapping for basic/advanced/pro and role sync converges Discord roles accordingly.
- [x] Role sync worker post-condition verification for grant/revoke (2026-02-16)
  Exit criteria: jobs only complete when target role state is confirmed on member after action; stale cache reads cannot produce false success.

### Phase 4: Mirroring (bot -> customer guild)

Goal: signals are mirrored to the customer guild with mapping for updates/deletes.

- [x] Bot posts new signals into mapped channels (2026-02-17)
  Exit criteria: new signal results in one mirrored message with p95 ingestion -> bot receive < 100ms.
- [x] Bot handles edits/deletes (2026-02-17)
  Exit criteria: mirrored messages update/delete consistently.
- [x] Rate-limit handling and retry strategy (2026-02-17)
  Exit criteria: bot survives transient Discord/API failures without drifting state.

### Phase 5: Attachments (Discord -> storage -> dashboard/mirror)

Goal: attachments are preserved and accessible across dashboard + mirror.

- [x] Store Discord attachments and references in Convex (2026-02-17)
  Exit criteria: attachments are accessible with references stored alongside signals.
- [x] Display attachments in dashboard (2026-02-17)
  Exit criteria: dashboard renders attachments safely (type/size restrictions).
- [x] Mirror attachments to Discord where appropriate (2026-02-17)
  Exit criteria: mirrored messages include attachments or stable links.

## Checklists / Hygiene

- [x] Reset docs and roadmap for Convex migration (2026-02-14)
  Exit criteria: docs no longer describe the legacy backend as the plan of record.
- [x] Align Docker build files with Bun lockfile/workspace setup (2026-02-15)
  Exit criteria: Docker builds copy `bun.lock` and use Bun install/build commands instead of pnpm artifacts.
- [x] Add per-service Coolify Dockerfiles for `admin` and `website` (2026-02-15)
  Exit criteria: each Next.js app can build and run independently via Bun in Docker using standalone output.
- [x] Scope auth to website only (no signup/login requirement for admin) (2026-02-15)
  Exit criteria: website provides Convex Auth login/signup flow; admin has no signup/login dependency.
- [x] Add initial Convex backend scaffold for website auth + core tables (2026-02-15)
  Exit criteria: `website/convex` includes auth config, auth/http functions, and base schema/query files deployable to self-hosted Convex.
- [x] Clarify Convex env domain mapping in docs/env examples (2026-02-15)
  Exit criteria: docs explicitly map backend origin vs site/dashboard origin for Convex URLs.
- [x] Clarify self-hosted Convex `/http` auth route prefix in env/docs (2026-02-16)
  Exit criteria: `CONVEX_SITE_URL` examples point to backend `/http` origin where `/.well-known/*` endpoints are reachable.
- [x] Clarify Convex client URL vs auth URL to prevent websocket 404s (2026-02-16)
  Exit criteria: docs explicitly require `NEXT_PUBLIC_CONVEX_URL` without `/http` and `CONVEX_SITE_URL` with `/http` for self-hosted auth routes.
- [x] Fix Convex Auth JWT header compatibility (`kid`/`typ`) for self-hosted Convex (2026-02-16)
  Exit criteria: website auth results in `useConvexAuth() === signed in` and backend `auth:isAuthenticated === true` after sign-in.
- [x] Bootstrap connector discovery metadata without preconfigured sources (2026-02-16)
  Exit criteria: discovery sync populates guild/channel selectors with names + IDs for a fresh connector.
- [x] Improve admin connector selection UX with guild-scoped channel filtering (2026-02-16)
  Exit criteria: source channel picker only shows channels from the selected guild; mapping/source tables show readable names with IDs.
- [x] Fix channel snapshot extraction from Discord ChannelStore wrappers + global fallback scan (2026-02-16)
  Exit criteria: channel-guild sync writes non-empty `discordChannels` rows for accessible guilds even when guild-scoped store helpers are empty, and admin channel dropdowns populate after snapshot sync.
- [x] Add ChannelStore method-probing fallbacks and diagnostics for channel discovery (2026-02-16)
  Exit criteria: plugin attempts multiple channel store APIs per guild, logs detected methods once, and increases discovery compatibility across Discord client variants.
- [x] Add Discord REST fallback for channel snapshot discovery (2026-02-16)
  Exit criteria: when store-derived channels are empty, plugin fetches guild channels via Discord REST and snapshot payload includes non-zero channels when the account can access them.
- [x] Improve REST fallback auth compatibility + diagnostics (2026-02-16)
  Exit criteria: plugin attempts token retrieval from storage and webpack runtime, and emits actionable REST HTTP diagnostics when channel REST fetches fail.
- [x] Add DOM fallback discovery for visible guild channels (2026-02-16)
  Exit criteria: when store and REST fallbacks are empty, plugin extracts channel IDs/names from rendered Discord channel links and sends them in discovery snapshots.
- [x] Add dynamic webpack channel-store fallback for non-standard Discord client exports (2026-02-16)
  Exit criteria: plugin scans webpack modules for richer channel-store APIs and uses them for discovery when the common ChannelStore wrapper is incomplete.
- [x] Constrain mapping source/target selectors to enabled available channels (2026-02-16)
  Exit criteria: mapping dropdowns no longer show all discovered channels; they only show channels explicitly saved/enabled in the left-side availability list.
- [x] Add admin-triggered guild channel fetch requests and remove periodic discovery sync loop (2026-02-16)
  Exit criteria: admin can request discovery for a selected guild via UI; plugin processes the request through runtime-config polling and does not run unconditional periodic snapshot sync.
- [x] Add source/target role flags for available channels and enforce source-only ingestion (2026-02-16)
  Exit criteria: admin can mark a channel as source/target/both; plugin only ingests from channels flagged as source; mapping source/target dropdowns are filtered by respective role flags.
- [x] Stabilize discovery fallback probing to avoid i18n proxy collisions and expose REST fetch failure diagnostics (2026-02-16)
  Exit criteria: plugin no longer emits `Requested message getAllChannels/getToken` warnings from scanner probes, and failed Discord REST channel fetch attempts emit explicit HTTP/network diagnostics per guild.
- [x] Reduce runtime-config churn by separating discovery requests from config updates (2026-02-16)
  Exit criteria: clicking "Fetch channels" triggers discovery sync without bumping connector config version, and plugin only reapplies runtime ingestion configuration after actual add/update changes.
- [x] Fix thread payload validation mismatch and harden thread event normalization (2026-02-16)
  Exit criteria: `/ingest/thread` no longer returns HTTP 400 for create/update/delete/member thread events generated by the plugin, including sparse payload variants.
- [x] Tighten dynamic channel-store detection to avoid non-channel module collisions (2026-02-16)
  Exit criteria: discovery probing no longer binds to i18n/proxy modules, `getChannels/getAllChannels` locale warnings stop, and guild channel snapshots populate reliably without opening each guild.
- [x] Separate automatic guild discovery from manual channel discovery (2026-02-16)
  Exit criteria: plugin publishes guild metadata without fetching all channels, and admin only requests channel discovery for a selected guild via "Fetch channels".
- [x] Reduce config polling latency and validate dynamic channel-store probe candidates (2026-02-16)
  Exit criteria: plugin processes discovery requests faster (low-second pickup), and channel store probes no longer trigger repeated locale-key warnings from non-channel modules.
- [x] Stabilize discovery auth/store lookups using Vencord webpack store APIs (2026-02-16)
  Exit criteria: plugin resolves Discord auth token via store lookup and avoids broad dynamic module probing that can call i18n proxy functions during channel discovery.
- [x] Add non-proxy channel fallback via guild object traversal (2026-02-16)
  Exit criteria: selected-guild channel discovery can extract channel IDs/names from guild object structures without invoking unstable store methods that trigger locale proxy warnings.
- [x] Prevent stale discovery replay and wait for guild-store readiness on startup (2026-02-16)
  Exit criteria: restarting Discord no longer auto-runs old guild-specific channel fetch requests, and initial guild metadata sync completes once GuildStore is populated.

## Decision Log

| Date | Decision | Link |
|---|---|---|
| 2026-02-14 | Pivot backend to Convex and hard-reset docs/roadmap | `docs/plans/2026-02-14-convex-adoption-design.md` |
| 2026-02-14 | Hard cutover auth to Convex Auth (email+password), start fresh (no Appwrite migration) | `docs/plans/2026-02-14-convex-auth-hard-cutover-design.md` |
| 2026-02-15 | Limit signup/login scope to website only; admin auth requirement removed | N/A |
| 2026-02-15 | Use `convex-backend.g3netic.com` as backend origin and `convex.g3netic.com` as site/dashboard origin in env docs | N/A |
| 2026-02-16 | Self-hosted Convex auth routes are served under `/http`; `CONVEX_SITE_URL` must use backend `/http` origin | N/A |
| 2026-02-16 | `NEXT_PUBLIC_CONVEX_URL` must not include `/http` to avoid websocket sync 404s (`/http/api/*`) | N/A |

## Links

- Convex adoption design: `docs/plans/2026-02-14-convex-adoption-design.md`
- Convex adoption plan: `docs/plans/2026-02-14-convex-adoption-plan.md`
