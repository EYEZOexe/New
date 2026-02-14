# Roadmap

Living plan for delivering G3netic Crypto Signals SaaS (web dashboard + customer Discord mirroring + Appwrite backend).

## Scope / North Star

Capture "signals" from a source Discord guild and deliver them to paying customers via:
- a web dashboard feed (`apps/web`)
- a customer Discord guild where a bot mirrors messages (`apps/bot`)

Backend is self-hosted Appwrite (`appwrite.g3netic.com`).

## Current Status

**Now**
- Discord OAuth linking + customer guild role assignment.

**Next**
- Observability + failure capture for webhook processing.

**Blockers / Risks**
- Appwrite Function domains: Appwrite Console shows "No domains available" for Functions (see `memory-bank/activeContext.md`). Not blocking Sell.app webhooks because we use a Cloudflare Worker proxy URL (`webhooks.g3netic.com`).

## Milestones (Phases)

### Phase 0: Foundations (mostly done)

- [x] Monorepo scaffold + Dockerfiles (see `memory-bank/progress.md`) (2026-02-13)
- [x] Appwrite bootstrap script + initial schema (2026-02-13)
- [x] Web auth + paid gating + SSR session cookie approach (2026-02-14)

### Phase 1: Payments + Access (Sell.app webhook)

Goal: payments reliably grant/revoke access even if the website is down.

- [x] Ensure webhook has a stable public HTTPS URL (Function domain or proxy) (2026-02-14)
  Exit criteria: Sell.app can deliver to a URL that returns 2xx and runs the handler.
- [x] End-to-end webhook test (grant paid team) (2026-02-14)
  Exit criteria: a purchase results in user added to `paid` team and subscription record upserted.
  Link: `docs/plans/2026-02-14-sellapp-webhook-pure-rest-design.md`, `docs/plans/2026-02-14-sellapp-webhook-pure-rest-plan.md`
- [x] End-to-end webhook test (revoke paid team) (2026-02-14)
  Exit criteria: dispute/refund (or simulated) removes user from `paid` team.
  Link: `docs/plans/2026-02-14-sellapp-webhook-pure-rest-design.md`, `docs/plans/2026-02-14-sellapp-webhook-pure-rest-plan.md`
- [x] Observability + failure capture for webhook processing (2026-02-14)
  Exit criteria: failures are recorded (e.g., `webhook_failures`) with enough context to retry.
  Link: `docs/plans/2026-02-14-webhook-failures-design.md`, `docs/plans/2026-02-14-webhook-failures-plan.md`

### Phase 2: Discord Linking (customer identity + roles)

Goal: customers can link Discord and get the right role(s) in the customer guild.

- [x] Discord OAuth linking flow in web app (2026-02-14)
  Exit criteria: user can link/unlink a Discord account; stored in Appwrite.
-  Link: `docs/plans/2026-02-14-discord-linking-appwrite-oauth-design.md`, `docs/plans/2026-02-14-discord-linking-appwrite-oauth-plan.md`
- [x] Customer guild role assignment automation (2026-02-14)
  Exit criteria: paid users get correct role; revoked users lose role.
-  Link: `docs/plans/2026-02-14-discord-linking-appwrite-oauth-design.md`, `docs/plans/2026-02-14-discord-linking-appwrite-oauth-plan.md`
- [ ] Admin visibility / support workflow
  Exit criteria: admin can look up a user and see Discord linkage + access status.

### Phase 3: Signal Pipeline (ingestion -> Appwrite -> dashboard)

Goal: signals show up in the dashboard quickly and consistently.

- [ ] Collector ingestion (Vencord plugin) writes normalized signal docs
  Exit criteria: messages from source guild appear in Appwrite `signals` collection.
- [ ] Dashboard feed reads signals and updates near realtime
  Exit criteria: paid user sees new signals with acceptable latency.
- [ ] Idempotency + edit/delete semantics defined
  Exit criteria: edits/deletes converge correctly across dashboard + bot.

### Phase 4: Mirroring (bot -> customer guild)

Goal: signals are mirrored to the customer guild with mapping for updates/deletes.

- [ ] Bot posts new signals into mapped channels
  Exit criteria: new signal document results in one mirror message.
- [ ] Bot handles edits/deletes
  Exit criteria: mirrored messages update/delete consistently.
- [ ] Rate-limit handling and retry strategy
  Exit criteria: bot survives transient Discord/API failures without drifting state.

### Phase 5: Attachments (Discord -> Appwrite Storage)

Goal: attachments are preserved and accessible across dashboard + mirror.

- [ ] Store Discord attachments in Appwrite Storage bucket `signal_assets`
  Exit criteria: attachments are uploaded with references stored alongside signal docs.
- [ ] Display attachments in dashboard
  Exit criteria: dashboard renders attachments safely (type/size restrictions).
- [ ] Mirror attachments to Discord where appropriate
  Exit criteria: mirrored messages include attachments or stable links.

## Checklists / Hygiene

- [ ] Guard or remove temporary debug endpoints (e.g. `/api/auth/debug`)
  Exit criteria: debug endpoints are not reachable in production builds.
- [x] Add Appwrite connectivity ping button on dashboard (2026-02-14)
  Exit criteria: logged-in user can hit `/api/appwrite/ping` from dashboard and see status/latency.
- [x] Bot: normalize Appwrite endpoint + log `/v1/ping` on startup (2026-02-14)
  Exit criteria: bot logs show resolved endpoint and ping status/snippet to debug 404/HTTP issues quickly.
- [x] Add script to upsert a test subscription doc by user email (2026-02-14)
  Exit criteria: we can create an `active` subscription with a given `plan` for testing role sync without waiting on Sell.app.

## Decision Log

| Date | Decision | Link |
|---|---|---|
| 2026-02-14 | Prefer Appwrite ops via MCP; keep scripts as fallback | `docs/appwrite-mcp-ops.md` |

## Links

- Product/system context: `memory-bank/projectbrief.md`, `memory-bank/systemPatterns.md`, `memory-bank/techContext.md`
- Current state/progress: `memory-bank/activeContext.md`, `memory-bank/progress.md`
- Appwrite ops: `docs/appwrite-mcp-ops.md`
- Appwrite ops design/plan: `docs/plans/2026-02-14-appwrite-mcp-ops-design.md`, `docs/plans/2026-02-14-appwrite-mcp-ops-plan.md`
- Sell.app webhook REST design/plan: `docs/plans/2026-02-14-sellapp-webhook-pure-rest-design.md`, `docs/plans/2026-02-14-sellapp-webhook-pure-rest-plan.md`

## How To Update This Roadmap

- Keep "Current Status" short; it should reflect what you're doing this week.
- For big items: create/update a dated doc in `docs/plans/` and link it from the relevant checklist item.
- When finishing a task: flip to done, add a completion date, and optionally link the PR/commit.

