# Discord Link + Login Redirect Fix Plan

> **Status:** Completed on 2026-02-20

**Goal:** Fix two regressions in `website`: login/signup not consistently redirecting after authenticated session creation, and Discord linking failing with generic server errors in dashboard flow.

**Architecture:** Preserve current auth/OAuth flows but harden client redirect behavior and make Discord link mutations resilient to downstream role-sync enqueue failures.

**Tech Stack:** Next.js App Router, React 19, Convex Auth, Convex mutations, TypeScript, Bun.

---

## Completed Tasks

- [x] Added authenticated-session redirect fallback on `/login` and `/signup` via `useConvexAuth()` so already-authenticated users are automatically routed to their resolved redirect target. (2026-02-20)
- [x] Switched login/signup post-auth navigation from `router.push(...)` to `router.replace(...)` to avoid stale auth-page history/route behavior. (2026-02-20)
- [x] Hardened `convex/discord.ts` link/unlink mutation flow so role-sync enqueue errors are logged but no longer block successful Discord link state persistence. (2026-02-20)
- [x] Preserved existing role-sync enqueue behavior when queue/config is healthy, including existing backend logs and grant/revoke intents. (2026-02-20)
- [x] Added explicit Discord-link error code propagation (`ConvexError`) and client-side friendly error mapping in dashboard controller to avoid opaque generic server-error text. (2026-02-20)
- [x] Kept strict one-account-per-Discord-user policy (active-link conflict still enforced) while surfacing a friendly conflict message to users when the same Discord account is already linked elsewhere. (2026-02-20)
- [x] Added shared user-facing error translation for auth flows so login/signup surfaces no longer show raw Convex/auth backend wording (invalid credentials, existing account, network/rate-limit cases). (2026-02-20)

---

## Verification Evidence

- `cd website && bun run typecheck` (pass)
- `cd website && bun test tests/discordOauth.test.js tests/userFacingErrors.test.js` (pass)
- `cd website && bun run build` (pass)
