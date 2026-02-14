# Roadmap

Living plan for delivering G3netic Crypto Signals SaaS (web dashboard + customer Discord mirroring + Convex backend).

## Scope / North Star

Capture "signals" from a source Discord guild and deliver them to paying customers via:

- a web dashboard feed (`apps/web`)
- a customer Discord guild where a bot mirrors messages (`apps/bot`)

Backend is Convex.

## Current Status

**Now**
- Establish Convex data model and auth strategy for `apps/web`.
- Define migration steps and stop adding new backend features to legacy code paths.
- Define and enforce realtime signal delivery targets (p95 < 100ms) across web, admin, and bot.

**Next**
- Move payments and access gating to Convex as the source of truth.
- Move Discord linking and role sync job queue to Convex.

**Blockers / Risks**
- Data migration. We need a clear plan to migrate users/subscriptions/signals into Convex without downtime.
- Auth and identity mapping. We need one stable user identifier across web, bot, and webhook processing.
- Webhook idempotency and retries. We need to guarantee "at least once" delivery does not create duplicate state.
- Performance. Sub-100ms p95 delivery requires careful schema/indexing and realtime subscriptions; polling is not acceptable on the critical path.

## Milestones (Phases)

### Phase 0: Foundations

- [ ] Convex project initialized for this repo
  Exit criteria: `apps/web` and backend functions can read/write Convex in dev.
- [ ] Schema defined for core entities (users, subscriptions, signals, discord linkage)
  Exit criteria: schema exists with indexes needed for critical queries.

### Phase 1: Payments + Access (Sell.app webhook)

Goal: payments reliably grant/revoke access even if the website is down.

- [ ] Webhook ingestion writes events and updates subscription state in Convex
  Exit criteria: a test webhook creates an event record, upserts subscription, and updates access gate.
- [ ] Failure capture + replay for webhook processing
  Exit criteria: failures are recorded with enough context to retry safely.
  Link: `docs/reliability.md`

### Phase 2: Discord Linking (customer identity + roles)

Goal: customers can link Discord and get the right role(s) in the customer guild.

- [ ] Discord OAuth linking flow stores linkage in Convex
  Exit criteria: user can link/unlink; linkage is stored and queryable.
- [ ] Role assignment automation via job queue stored in Convex
  Exit criteria: paid users get correct role; revoked users lose role.

### Phase 3: Signal Pipeline (ingestion -> Convex -> dashboard)

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

## Decision Log

| Date | Decision | Link |
|---|---|---|
| 2026-02-14 | Pivot backend to Convex and hard-reset docs/roadmap | `docs/plans/2026-02-14-convex-adoption-design.md` |
| 2026-02-14 | Hard cutover auth to Convex Auth (email+password), start fresh (no Appwrite migration) | `docs/plans/2026-02-14-convex-auth-hard-cutover-design.md` |

## Links

- Convex adoption design: `docs/plans/2026-02-14-convex-adoption-design.md`
- Convex adoption plan: `docs/plans/2026-02-14-convex-adoption-plan.md`
