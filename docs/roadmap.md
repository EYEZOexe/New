# Roadmap

Living plan for delivering G3netic Crypto Signals SaaS (web dashboard + customer Discord mirroring + Convex backend).

## Scope / North Star

Capture "signals" from a source Discord guild and deliver them to paying customers via:

- a web dashboard feed (`apps/web`)
- a customer Discord guild where a bot mirrors messages (`apps/bot`)

Backend is Convex.

## Current Status

**Now**
- Website signup/login is validated end-to-end against self-hosted Convex (`https://convex-backend.g3netic.com`) using domain mapping:
  `convex-backend.g3netic.com` = backend origin, `convex-backend.g3netic.com/http` = auth/OIDC routes, and `convex.g3netic.com` = dashboard origin. (2026-02-16)
- Establish Convex data model and auth strategy for `website`; `admin` does not require customer signup/login.
- Define migration steps and stop adding new backend features to legacy code paths.
- Define and enforce realtime signal delivery targets (p95 < 100ms) across web, admin, and bot.

**Next**
- Move payments and access gating to Convex as the source of truth.
- Move Discord linking and role sync job queue to Convex.

**Blockers / Risks**
- Data migration. We need a clear plan to migrate users/subscriptions/signals into Convex without downtime.
- Auth and identity mapping. We need one stable user identifier across web, bot, and webhook processing.
- Convex Auth configuration. Self-hosted Convex must be configured with signing keys/JWKS and correct site URL, otherwise auth flows will fail at runtime.
- Convex Auth issuer should be HTTPS. The current self-hosted issuer is `http://convex-backend.g3netic.com/http`; align `CONVEX_CLOUD_ORIGIN`/`CONVEX_SITE_ORIGIN` + proxy headers so OIDC metadata uses `https://...` to avoid mixed-scheme issues.
- Convex deployment credentials. We need `CONVEX_SELF_HOSTED_ADMIN_KEY` available in CI/deploy to push schema/functions to self-hosted Convex.
- Bun migration consistency. Build and CI/deploy tooling must stay aligned with Bun lockfiles/workspaces or deployments will fail before app startup.
- Webhook idempotency and retries. We need to guarantee "at least once" delivery does not create duplicate state.
- Performance. Sub-100ms p95 delivery requires careful schema/indexing and realtime subscriptions; polling is not acceptable on the critical path.

## Milestones (Phases)

### Phase 0: Foundations

- [x] Convex project initialized for this repo (2026-02-16)
  Exit criteria: `apps/web` and backend functions can read/write Convex in dev.
- [x] Cut over website auth to Convex Auth (email + password) (2026-02-15)
  Exit criteria: `website` build includes Convex Auth login/signup and uses `NEXT_PUBLIC_CONVEX_URL`; admin is explicitly out of scope for signup/login.
- [x] Schema defined for core entities (users, subscriptions, signals, discord linkage) (2026-02-15)
  Exit criteria: schema exists with indexes needed for critical queries (`website/convex/schema.ts`).

### Phase 2: Payments + Access (Sell.app webhook)

Goal: payments reliably grant/revoke access even if the website is down.

- [ ] Webhook ingestion writes events and updates subscription state in Convex
  Exit criteria: a test webhook creates an event record, upserts subscription, and updates access gate.
- [ ] Failure capture + replay for webhook processing
  Exit criteria: failures are recorded with enough context to retry safely.
  Link: `docs/reliability.md`

### Phase 3: Discord Linking (customer identity + roles)

Goal: customers can link Discord and get the right role(s) in the customer guild.

- [ ] Discord OAuth linking flow stores linkage in Convex
  Exit criteria: user can link/unlink; linkage is stored and queryable.
- [ ] Role assignment automation via job queue stored in Convex
  Exit criteria: paid users get correct role; revoked users lose role.

### Phase 1: Signal Pipeline (ingestion -> Convex -> dashboard)

Goal: signals show up in the dashboard quickly and consistently.

- [ ] Collector ingestion writes normalized signal docs to Convex
  Exit criteria: new messages appear in Convex and are queryable by customer.
- [ ] Dashboard feed reads signals and updates near realtime
  Exit criteria: paid user sees new signals with p95 end-to-end delivery < 100ms.
- [ ] Idempotency + edit/delete semantics defined
  Exit criteria: edits/deletes converge correctly across dashboard + bot.

### Phase 4: Mirroring (bot -> customer guild)

Goal: signals are mirrored to the customer guild with mapping for updates/deletes.

- [ ] Bot posts new signals into mapped channels
  Exit criteria: new signal results in one mirrored message with p95 ingestion -> bot receive < 100ms.
- [ ] Bot handles edits/deletes
  Exit criteria: mirrored messages update/delete consistently.
- [ ] Rate-limit handling and retry strategy
  Exit criteria: bot survives transient Discord/API failures without drifting state.

### Phase 5: Attachments (Discord -> storage -> dashboard/mirror)

Goal: attachments are preserved and accessible across dashboard + mirror.

- [ ] Store Discord attachments and references in Convex
  Exit criteria: attachments are accessible with references stored alongside signals.
- [ ] Display attachments in dashboard
  Exit criteria: dashboard renders attachments safely (type/size restrictions).
- [ ] Mirror attachments to Discord where appropriate
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
- Discord ingest design: `docs/plans/2026-02-16-discord-ingest-convex-design.md`
- Discord ingest plan: `docs/plans/2026-02-16-discord-ingest-convex-plan.md`
