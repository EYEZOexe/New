# Design: Discord Linking (Appwrite OAuth, Link-Only)

Date: 2026-02-14

## Goal

Let an already-logged-in web user link/unlink a Discord account (via Appwrite OAuth provider), store the linkage in Appwrite, and drive customer-guild role assignment based on subscription plan.

## Non-Goals

- Supporting “login with Discord” as a primary auth method in the web app.
- Directly calling Discord APIs from the web app (Discord actions should be handled by the bot worker).
- Building an admin UI for managing role mappings (store in Appwrite for now; UI can come later).

## Approaches Considered

### 1) Web App Directly Calls Discord APIs

After linking completes, `apps/web` uses the bot token to grant/revoke roles.

- Pros: fewer services involved.
- Cons: couples web to Discord reliability/rate limits; harder retries; webhook-like failures become user-facing.

### 2) Outbox + Bot Worker (Recommended)

`apps/web` links/unlinks and writes a `role_sync_jobs` document. `apps/bot` processes jobs and calls Discord.

- Pros: isolates Discord flakiness and rate limits; aligns with `docs/reliability.md` outbox guidance; retries are simple.
- Cons: requires a small job collection and bot logic.

### 3) Appwrite Function For Role Sync

Use an Appwrite Function (scheduled/triggered) to process jobs instead of the bot.

- Pros: keeps bot thinner.
- Cons: more Appwrite Function ops and secret handling; still needs Discord API integration.

Decision: choose **Approach 2**.

## Design

### A) Data Model

Existing (bootstrap):
- Database: `crypto`
- Collection: `profiles` (document security enabled)
  - `userId` (string, required)
  - `discordUserId` (string, optional)
  - `discordLinkedAt` (datetime, optional)
- Collection: `subscriptions` (document security enabled)
  - `userId` (string, required)
  - `status` (enum: active/inactive/cancelled/past_due, required)
  - `plan` (string, optional)

New:
- Collection: `discord_role_mappings` (admin-only)
  - `plan` (string, required, unique)
  - `guildId` (string, required)
  - `roleIdsJson` (string, required) JSON string array of role IDs, e.g. `["123","456"]`

Reason for `roleIdsJson`: avoid depending on Appwrite array attribute support/version specifics; keep it explicit and debuggable.

- Collection: `role_sync_jobs` (admin-only)
  - `userId` (string, required)
  - `discordUserId` (string, optional)
  - `guildId` (string, required)
  - `desiredRoleIdsJson` (string, required) JSON string array
  - `status` (enum: pending/processing/done/failed, required)
  - `attempts` (int, required, default 0 at application layer)
  - `lastError` (string, optional)
  - `lastAttemptAt` (datetime, optional)
  - `createdAt` (datetime, optional, server-set)
  - `updatedAt` (datetime, optional, server-set)

### B) Linking Flow (Appwrite OAuth Provider, Link-Only)

Principles:
- Linking requires an existing web session (your SSR cookie storing Appwrite session cookie value).
- Callback must not be able to switch users.
- Use a CSRF state cookie to bind browser session to the OAuth completion.

#### 1) Start Linking

Route: `POST /api/auth/discord/start`

Behavior:
- Require logged-in user (validate via existing session cookie).
- Generate `state` (cryptographically random).
- Store `state` in a short-lived HttpOnly cookie (e.g. 10 minutes).
- Request an Appwrite OAuth token URL using the current user session:
  - `GET /v1/account/tokens/oauth2/discord?success=<SUCCESS_URL>&failure=<FAILURE_URL>`
  - `SUCCESS_URL` should be your app route, e.g. `/api/auth/discord/complete?state=<state>`
  - `FAILURE_URL` should return the user to dashboard with an error.
- Redirect (302) the user to the URL Appwrite returns (Discord authorize URL).

Notes:
- This is intentionally “link-only”: user must already be logged in, and we always associate the identity with the current Appwrite user.

#### 2) Complete Linking

Route: `GET /api/auth/discord/complete?state=...&userId=...&secret=...`

Behavior:
- Verify `state` matches the cookie; clear the cookie.
- Verify current logged-in user matches the `userId` query param.
  - If mismatch: hard fail (no linking).
- Exchange token for session:
  - `POST /v1/account/sessions/token` using `{ userId, secret }`
  - Extract Appwrite session cookie value from `Set-Cookie`
  - Replace the web app’s session cookie with the new value.
  - (This should remain the same user; it’s a session refresh.)
- Fetch identities:
  - `GET /v1/account/identities`
  - Find the `discord` identity; use `providerUid` as `discordUserId`.
- Upsert `profiles` doc with document ID = Appwrite user id:
  - `userId`
  - `discordUserId`
  - `discordLinkedAt = now`
- Enqueue a role sync job (see section D).
- Redirect back to `/dashboard` with a success indicator.

#### 3) Unlink

Route: `POST /api/auth/discord/unlink`

Behavior:
- Require logged-in user.
- `GET /v1/account/identities`, find Discord identity.
- `DELETE /v1/account/identities/{identityId}`.
- Update `profiles`:
  - `discordUserId = null`
  - `discordLinkedAt = null`
- Enqueue a role sync job (desired roles becomes empty).

### C) Role Mapping Rule

Decision: plan-based roles.

Rule:
- If subscription `status` is not `active`, desired roles are empty (remove).
- If `status` is `active`, map `subscriptions.plan` to the role IDs using `discord_role_mappings` for the customer guild.

### D) Role Sync Automation (Outbox + Bot Worker)

`apps/web` is responsible for converging desired state and emitting jobs.

When to enqueue a job:
- After successful Discord link.
- After successful Discord unlink.
- After subscription plan/status changes (future: hook from webhook processing or a reconciliation job).

Job shape:
- `desiredRoleIdsJson` is the computed desired set.
- `status = pending`.

`apps/bot` is responsible for applying roles:
- Poll `role_sync_jobs` for `pending` jobs (limit + oldest-first).
- Mark job `processing`.
- Ensure the Discord user is a member of the customer guild.
  - If not present, mark failed with a clear “member not found” error and stop retrying until user joins.
- Add/remove roles to match the desired set.
- Mark done or failed (increment attempts, store lastError).

Retry strategy:
- Basic backoff based on `attempts`.
- Treat Discord `429` and transient `5xx` as retryable.

### E) Error Handling / Security

- Never trust callback query parameters.
- `state` is mandatory and must match an HttpOnly cookie.
- Do not leak Discord tokens or secrets to logs.
- Hard-fail on `userId` mismatch to prevent account swapping.
- If no Discord identity is found after completion, return the user to dashboard with an error and record enough server logs for diagnosis.

### F) Verification

Manual smoke test:
- Logged-in user links Discord.
- `profiles.discordUserId` + `discordLinkedAt` set.
- A `role_sync_jobs` document is created.
- Bot processes the job and applies the mapped roles for the user.

Automated tests (minimum):
- Start endpoint requires auth.
- Complete endpoint rejects missing/invalid state.
- Complete endpoint rejects `userId` mismatch.
- Mapping logic produces expected desired roles for active vs inactive subscriptions.

