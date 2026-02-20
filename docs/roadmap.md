# Roadmap

Living plan for delivering G3netic Crypto Signals SaaS (web dashboard + customer Discord mirroring + Convex backend).

## Scope / North Star

Capture "signals" from a source Discord guild and deliver them to paying customers via:

- a web dashboard feed (`apps/web`)
- a customer Discord guild where a bot mirrors messages (`apps/bot`)

Backend is Convex.

## Current Status

**Now**
- Fixed sparse attachment-update ingest regression causing some signal rows to lose text content: Convex ingest now preserves existing non-empty content when update payloads arrive attachment-only, legacy Discord plugin now accepts attachment-only `MESSAGE_UPDATE` events (while skipping truly empty sparse updates), and new regression coverage was added in `website/tests/ingestContentMerge.test.js`. Verified with `bun test website/tests/ingestContentMerge.test.js website/tests/ingestAttachmentMerge.test.js website/tests/ingestUtils.test.js`, `website` typecheck, and `Discord-Bot` typecheck. (2026-02-19)
- Completed customer-readiness redesign pass for all non-dashboard website routes (`/`, `/shop`, `/login`, `/signup`, `/checkout/return`): aligned shell structure with dashboard visual language, replaced cluttered card stacking with clearer section rhythm, and tightened pricing/auth IA for conversion-focused SaaS UX. Verified with `website` typecheck/build. (2026-02-19)
- Rebuilt all non-dashboard customer pages from scratch (`/`, `/shop`, `/login`, `/signup`, `/checkout/return`) on a dedicated marketing layout system with customer-ready copy and cleaner SaaS page composition (no backend/internal platform messaging). Verified with `website` typecheck/build. (2026-02-19)
- Completed SaaS layout quality pass for website auth/shop pages: restructured `shop` hero and pricing cards for cleaner hierarchy/spacing, reduced visual clutter in login/signup informational panes, and standardized auth form card composition for a more professional product surface. Verified with `website` typecheck/build. (2026-02-19)
- Applied Convex backend rollout for website workspace/journal updates via `bunx convex dev --once --env-file website/.env.example`; post-deploy function smoke queries (`workspace:listMarketSnapshots`, `workspace:listStrategies`, `workspace:listNewsArticles`) returned callable payloads. (2026-02-19)
- Completed second-pass website workspace polish: improved cross-module visual consistency and interaction behavior across `live-intel`, `indicators`, `strategies`, and `news` surfaces (timeframe-aware live intel filtering, strategy tag filtering, better empty states, and stronger card interaction affordances). Also executed Convex env sync from `website/.env.example` for non-placeholder runtime keys via CLI. (2026-02-19)
- Completed website member experience restructure: promoted `/dashboard` from compatibility redirect to a real workspace-shell page, widened site layout constraints to better use desktop viewport space, refreshed login/signup/shop IA, made workspace auth gating redirect-safe, and upgraded trading journal to computed analytics (profit factor/expectancy/drawdown), interactive P&L calendar, and equity curve visualization with validated closed-trade persistence + backend P&L fallback calculation. (2026-02-19)
- Implemented Convex-powered live workspace ingestion: added `internal.workspace.refreshExternalWorkspaceFeeds` (CoinGecko + CryptoCompare fetch), idempotent upsert/replace mutations for `marketSnapshots` / `liveIntelItems` / `indicatorAlerts` / `newsArticles`, automatic default strategy seeding, and 2-minute cron scheduling in `convex/crons.ts`; also executed a one-off live refresh to populate current rows. (2026-02-17)
- Connected `website` workspace modules to live Convex data contracts: `markets`, `live-intel`, `signals`, `indicators`, `strategies`, `journal`, and `news` pages now read from Convex queries (`workspace:*`, `signals:listRecent`, `users:viewer`), and journal trade logging now persists through Convex mutation (`workspace:createJournalTrade`) with validated form payloads. Also introduced new Convex workspace domain tables for market/intel/indicator/strategy/news/journal data storage. (2026-02-17)
- Executed initial trader workspace expansion in `website`: added authenticated `/workspace/*` IA (`overview`, `markets`, `live-intel`, `signals`, `indicators`, `strategies`, `journal`, `news`), shared sidebar/topbar shell primitives, `/dashboard` compatibility redirect, module adapters with tests, and modal workflows for symbol/trade/strategy details plus trade logging schema validation. (2026-02-17)
- Approved trader workspace expansion design + implementation plan for `website`: introduces authenticated `/workspace/*` route IA (overview, markets, live-intel, signals, indicators, strategies, journal, news), shared sidebar/topbar shell, modal workflow patterns, and phased adapter-first data integration to incorporate high-density trading UI elements while preserving existing Convex entitlement/Discord flows. (2026-02-17)
- Completed SaaS website layout polish across home/login/signup/dashboard: introduced stronger header IA with metric callouts, cleaner responsive content hierarchy (including two-column auth layouts), improved visual rhythm/typography tokens, and refined dashboard signal-card readability for long IDs/content/attachments. (2026-02-17)
- Fixed intermittent signal attachment drops in Convex ingest dedupe/update flow: sparse non-delete events (empty attachment arrays) now preserve previously stored attachment refs instead of overwriting them, with backend diagnostics (`[ingest] preserved existing attachment refs...`) plus regression tests in `website/tests/ingestAttachmentMerge.test.js`. (2026-02-17)
- Hardened Sell payment-method loading in admin wizard: `sellProducts:listSellPaymentMethods` now fails soft (no client-thrown server error) and supports terminal-configured fallback methods via `SELLAPP_DEFAULT_PAYMENT_METHODS` when API discovery returns none/errors; wizard Step 3 now shows the terminal command hint for setting fallback defaults. (2026-02-17)
- Fixed Sell wizard payment method failures (`The selected payment_methods.0 is invalid`): admin Step 3 now loads selectable payment methods from Sell product variant API data (`sellProducts:listSellPaymentMethods`) instead of hardcoding `STRIPE`, and Convex variant upsert now only sends `payment_methods` when valid methods are provided/discovered (otherwise it defers to Sell defaults). (2026-02-17)
- Fixed Sell checkout draft/404 path for wizard-created products: wizard Step 3 now provisions a real Sell product variant (price + payment method + manual deliverable) through Convex (`sellProducts:upsertSellProductVariant`) before saving local catalog variant metadata, and product policy-linked checkout URL `https://g3netic.sell.app/product/new-teste?...` now resolves successfully after variant + visibility sync. (2026-02-17)
- Fixed shop setup wizard product picker behavior for Sell draft/hidden products: because Sell list API returns only public/live products, the wizard now preserves newly created draft products in-session and merges policy-linked product keys into selectable options so product->policy->variant setup remains continuous without manual ID re-entry. (2026-02-17)
- Added Sell product lifecycle management directly inside admin policies: operators can list/create/update Sell products via API-backed Convex actions (`sellProducts:*`), reuse product IDs in policy mappings (`productId|slug`), and monitor frontend/backend logs for product sync outcomes. Also completed an admin dark-theme pass across workspace shell surfaces and reworked mappings UX with editable available-channel/mapping rows, scrollable sticky-header tables, and richer recent mirror-job status/error visibility. (2026-02-17)
- Fixed Sell checkout URL generation mismatch causing 404 storefront links when product policies used numeric IDs: admin catalog auto-checkout now treats numeric-only product IDs as non-resolvable, supports `productId|slug` policy format (for example `349820|basic-plan`) so entitlement matching still uses webhook IDs while checkout links resolve to slug-based storefront URLs, and Convex policy resolution now accepts alias-formatted IDs during webhook matching. (2026-02-17)
- Completed admin workspace route refactor implementation: admin now uses unified sidebar workspace IA (`/mappings`, `/discord-bot`, `/shop/*`), shared shell/page primitives, canonical route migrations with legacy redirects (`/connectors`, `/discord`, `/payments/*`), and verified route helpers/breadcrumbs coverage in `admin/tests/adminRoutes.test.ts`. (2026-02-17)
- Completed full `website` dark-theme redesign and componentization pass: home/shop/dashboard/checkout-return/login/signup now share a unified nocturnal visual system, use `shadcn` UI primitives (`Card`, `Button`, `Badge`, `Input`, `Alert`) with reusable site shell components, and dashboard logic is split from a monolithic page into dedicated hook/types/utils/component modules for maintainability. (2026-02-17)
- Completed component-structure cleanup for redesigned catalog/shop surfaces: `admin` catalog now uses a split hook+component architecture (no monolithic page), and `website` shop now uses `useShopCatalog` + dedicated hero/tier card components with lighter render work and stable selection state updates. (2026-02-17)
- Synced self-hosted Convex env variables from `website/.env.example` for non-placeholder keys via CLI; `CONVEX_SITE_URL` remains deployment-managed because Convex rejects overriding built-in env var names via `convex env set`. (2026-02-17)
- Applied Phase 6 UX correction pass for catalog/shop quality: admin `/payments/catalog` now uses policy-driven checkout wiring with automatic checkout URL generation from selected Sell product policies (custom URL only as advanced override), and both admin catalog + website shop surfaces were visually refreshed with stronger hierarchy/contrast and richer merchandising presentation. (2026-02-17)
- Completed Phase 6 storefront/admin redesign rollout: Convex now includes admin-managed shop catalog domain (`shopTiers`, `shopVariants`) with strict policy-link validation and consistent mutation error shapes, connector mappings now support explicit dashboard visibility + minimum-tier rules, website dashboard feed now applies hidden-by-default tier visibility filtering per mapping, admin now includes redesigned home/payments surfaces plus realtime catalog management, website now ships redesigned home/shop/dashboard and realtime checkout-return state, and Discord-Bot queue workers now use event-driven Convex wake subscriptions with bounded fallback polling instead of fixed ultra-low claim loops. (2026-02-17)
- Approved Phase 6 product/UX design for website/admin modernization: tier-first shop with admin-managed catalog, realtime checkout-return/dashboard state, website-only tier-gated dashboard signal visibility (default hidden until explicitly configured), and worker queue architecture upgrade from fixed ultra-low polling to event-driven wakeups with bounded fallback polling to reduce empty claim spam while preserving low-latency mirroring targets. (2026-02-17)
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
- Monitor queue-wake rollout metrics (`wake source`, `empty/non-empty claim outcomes`, pickup latency) and tune bounded fallback ranges if websocket quality degrades in production.
- Add operational dashboards/alerts for shop catalog publish validation failures (`policy_link_required`, `policy_link_disabled`, checkout URL validation).

**Blockers / Risks**
- Local Windows/Bun CLI caveat during `convex run` smoke checks: command returns valid payload output but exits with a post-output `uv` assertion (`!(handle->flags & UV_HANDLE_CLOSING)`); deploy operations still succeed, but local CLI verification ergonomics are degraded until runtime/tooling update.
- External provider dependency for workspace feeds. Market/news ingestion relies on public upstream APIs (CoinGecko/CryptoCompare); provider outages, schema changes, or rate limits can temporarily reduce feed freshness.
- Sell product CRUD in admin depends on `SELLAPP_API_TOKEN` being configured in Convex runtime env; missing token causes product list/create/update actions to fail (`sell_api_token_missing`).
- Data migration. We need a clear plan to migrate users/subscriptions/signals into Convex without downtime.
- Auth and identity mapping. We need one stable user identifier across web, bot, and webhook processing.
- Convex Auth configuration. Self-hosted Convex must be configured with signing keys/JWKS and correct site URL, otherwise auth flows will fail at runtime.
- Convex Auth issuer should be HTTPS. The current self-hosted issuer is `http://convex-backend.g3netic.com/http`; align `CONVEX_CLOUD_ORIGIN`/`CONVEX_SITE_ORIGIN` + proxy headers so OIDC metadata uses `https://...` to avoid mixed-scheme issues.
- Convex deployment credentials. We need `CONVEX_SELF_HOSTED_ADMIN_KEY` available in CI/deploy to push schema/functions to self-hosted Convex.
- Convex built-in env management caveat. `CONVEX_SITE_URL` cannot be overridden with `convex env set`; it must be controlled through deployment/runtime configuration.
- Discord OAuth app configuration. `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and callback URL registration must stay aligned with deployed `NEXT_PUBLIC_APP_URL` / `DISCORD_REDIRECT_URI`.
- Discord role sync configuration/permissions. `ROLE_SYNC_BOT_TOKEN` must be aligned across Convex + bot env; tier role mappings must be maintained in admin (`/discord-bot`) or legacy fallback env must be set; bot needs `Manage Roles` with hierarchy above all managed customer tier roles.
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

### Phase 6: Storefront + Admin UX + Tier-Gated Dashboard

Goal: deliver a conversion-focused shop/admin experience and enforce tier-based dashboard signal visibility.

- [x] Add admin-managed shop catalog domain (tiers + per-tier duration variants + policy linkage) (2026-02-17)
  Exit criteria: operator can manage presentation variants without modifying enforcement policy logic.
- [x] Add website tier-first shop + checkout-return state powered by realtime Convex data (2026-02-17)
  Exit criteria: customer can select tier/duration and launch external Sell checkout from a polished storefront.
- [x] Enforce website-only dashboard visibility by mapping/channel minimum tier rules (2026-02-17)
  Exit criteria: signal feed content is filtered by subscription tier with hidden-by-default mapping behavior.
- [x] Replace worker fixed low-interval claim loops with event-driven queue wakeups (2026-02-17)
  Exit criteria: idle queue claim mutation spam is significantly reduced while maintaining low-latency processing when jobs arrive.
- [x] Refactor admin workspace IA to sidebar-based route domains (`/mappings`, `/discord-bot`, `/shop/*`) with legacy redirects and shared shell/page composition primitives (2026-02-17)
  Exit criteria: canonical admin routes use shared workspace shell + breadcrumbs/header/table primitives, legacy paths redirect, and admin route helper tests pass.
- [x] Polish website layout hierarchy and responsive UX for home/auth/dashboard surfaces (2026-02-17)
  Exit criteria: shared page/header primitives enforce clearer visual hierarchy and spacing, auth pages use split informational + form layout on desktop, and dashboard feed cards remain readable for long metadata/content.
- [x] Introduce workspace route-group shell and multi-module member UI surfaces in `website` (`/workspace/*`) with compatibility redirect from `/dashboard` (2026-02-17)
  Exit criteria: workspace routes build/typecheck pass, sidebar/topbar shell is shared, module adapter tests pass, and journal trade schema validation test coverage is present.
- [x] Promote `/dashboard` to canonical workspace entry and upgrade journal analytics from placeholders to computed metrics/charts/calendar with validated persistence rules. (2026-02-19)
  Exit criteria: `/dashboard` renders workspace shell directly, `/workspace/overview` compatibility remains intact, journal KPIs/curve/calendar derive from stored trade data, and website tests/typecheck/build pass.
- [x] Complete second-pass workspace module UX consistency pass and refresh Convex env values from `website/.env.example`. (2026-02-19)
  Exit criteria: module-level cards/filtering/empty states are consistent across key workspace pages and Convex runtime env sync command succeeds for non-placeholder keys.
- [x] Deploy latest Convex function/schema set from `website` and execute post-deploy workspace query smoke checks. (2026-02-19)
  Exit criteria: `convex dev --once` succeeds with current env file context and workspace queries are callable after deploy.
- [x] Finalize professional SaaS layout composition for website auth/shop surfaces (hierarchy, spacing, card composition). (2026-02-19)
  Exit criteria: auth and shop pages avoid crowded blocks, card internals are structured, and `website` typecheck/build pass.
- [x] Rebuild non-dashboard customer experience from scratch with dedicated marketing layout and customer-first content. (2026-02-19)
  Exit criteria: `/`, `/shop`, `/login`, `/signup`, and `/checkout/return` use cohesive marketing composition, remove backend jargon, and pass website verification commands.
- [x] Execute customer-readiness second-pass redesign for non-dashboard pages with dashboard-aligned shell composition and conversion-focused pricing/auth layout. (2026-02-19)
  Exit criteria: non-dashboard page composition avoids floating-card clutter, uses clearer section hierarchy and responsive spacing, and `website` typecheck/build pass.

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
| 2026-02-17 | Adopt split-domain Phase 6 architecture (policy enforcement separated from shop catalog), website-only tier-gated dashboard visibility, and event-driven worker queue wakeups replacing fixed ultra-low polling | `docs/plans/2026-02-17-shop-admin-redesign-design.md` |
| 2026-02-17 | Execute Phase 6 implementation plan across Convex/admin/website/Discord-Bot with verification and roadmap sync | `docs/plans/2026-02-17-shop-admin-redesign-plan.md` |
| 2026-02-17 | Remove manual per-variant checkout URL authoring in admin catalog default flow; auto-build checkout from selected Sell product policy + storefront origin with custom override only for edge cases | N/A |
| 2026-02-17 | Approve full admin workspace route rewrite centered on sidebar IA (`Mappings`, `Discord Bot`, `Shop`) with route migrations + redirects | `docs/plans/2026-02-17-admin-workspace-refactor-design.md` |
| 2026-02-17 | Define implementation task plan for admin workspace refactor with verification gates (`typecheck`, `build`, smoke checks) | `docs/plans/2026-02-17-admin-workspace-refactor-plan.md` |
| 2026-02-17 | Apply website UI layout polish pass focused on hierarchy, responsive composition, and feed readability across home/auth/dashboard | N/A |
| 2026-02-17 | Approve trader workspace expansion IA for `website` using `/workspace/*` modules + shared shell with phased execution plan | `docs/plans/2026-02-17-trader-workspace-expansion-design.md` |
| 2026-02-17 | Execute workspace expansion implementation tasks for shared shell, module routes, adapters/tests, and modal workflows in `website` | `docs/plans/2026-02-17-trader-workspace-expansion-plan.md` |
| 2026-02-17 | Wire workspace module pages to live Convex query/mutation data paths and add dedicated workspace domain tables for market/intel/indicator/strategy/news/journal datasets | `docs/plans/2026-02-17-trader-workspace-expansion-plan.md` |
| 2026-02-17 | Add scheduled external feed ingestion for workspace modules (Convex internal action + cron + upsert mutations) and trigger first live refresh | `docs/plans/2026-02-17-trader-workspace-expansion-plan.md` |
| 2026-02-19 | Execute website member experience restructure for canonical dashboard routing, wider layout usage, auth/shop refresh, and functional journal analytics | `docs/plans/2026-02-19-website-experience-restructure-plan.md` |
| 2026-02-19 | Execute second-pass workspace UI consistency polish and Convex env sync from `website/.env.example` | `docs/plans/2026-02-19-website-experience-restructure-plan.md` |
| 2026-02-19 | Push Convex backend updates (`convex dev --once`) and run post-deploy workspace smoke queries | `docs/plans/2026-02-19-website-experience-restructure-plan.md` |
| 2026-02-19 | Complete professional SaaS layout pass for website login/signup/shop composition quality | `docs/plans/2026-02-19-website-experience-restructure-plan.md` |
| 2026-02-19 | Rebuild non-dashboard website pages from scratch on dedicated marketing layout with customer-facing messaging | `docs/plans/2026-02-19-website-experience-restructure-plan.md` |
| 2026-02-19 | Execute customer-readiness second pass for non-dashboard website IA/layout with dashboard-aligned shell and cleaner pricing/auth UX | `docs/plans/2026-02-19-website-experience-restructure-plan.md` |

## Links

- Convex adoption design: `docs/plans/2026-02-14-convex-adoption-design.md`
- Convex adoption plan: `docs/plans/2026-02-14-convex-adoption-plan.md`
- Shop/admin redesign design: `docs/plans/2026-02-17-shop-admin-redesign-design.md`
- Shop/admin redesign implementation plan: `docs/plans/2026-02-17-shop-admin-redesign-plan.md`
- Admin workspace refactor design: `docs/plans/2026-02-17-admin-workspace-refactor-design.md`
- Admin workspace refactor implementation plan: `docs/plans/2026-02-17-admin-workspace-refactor-plan.md`
- Trader workspace expansion design: `docs/plans/2026-02-17-trader-workspace-expansion-design.md`
- Trader workspace expansion implementation plan: `docs/plans/2026-02-17-trader-workspace-expansion-plan.md`
- Website member experience restructure implementation plan: `docs/plans/2026-02-19-website-experience-restructure-plan.md`
