# Design: Sell.app Webhook Function (Pure REST)

Date: 2026-02-14

## Goal

Make `functions/sellapp-webhook` process Sell.app webhooks end-to-end using **only Appwrite REST APIs** (no `node-appwrite` SDK inside the Function), while keeping stable Appwrite IDs:

- Database: `crypto`
- Collections: `subscriptions`, `webhook_events` (and others created by bootstrap)
- Teams: `paid`, `admins`, `collectors`
- Bucket: `signal_assets`
- Function ID: `sellapp-webhook`

## Non-Goals

- Solving the public HTTPS URL / Function domain / Cloudflare TLS issues.
- Implementing the full Discord linking pipeline.
- Implementing retries/queueing beyond basic idempotency.

## Why Pure REST

- Avoid SDK/runtime mismatch problems between Appwrite server versions and `node-appwrite` versions.
- Reduce coupling inside the Function to one tiny HTTP adapter.
- Make request/response behavior explicit and debuggable (status codes + payloads).

## Inputs

### HTTP Request

- Method: `POST`
- Headers:
  - `signature`: Sell.app HMAC-SHA256 hex signature
  - `Content-Type: application/json`
- Body:
  - Use `req.bodyText` as the raw bytes (Appwrite Functions provide `req.bodyText`).

### Function Variables (env)

Required:
- `SELLAPP_WEBHOOK_SECRET`
- `APPWRITE_ENDPOINT` (example: `https://appwrite.g3netic.com/v1`)
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY` (server key)
- `APPWRITE_DATABASE_ID=crypto`
- `APPWRITE_SUBSCRIPTIONS_COLLECTION_ID=subscriptions`
- `APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID=webhook_events`
- `APPWRITE_TEAM_PAID_ID=paid`

Recommended:
- `APP_BASE_URL` (used as `url` when creating team memberships; Appwrite docs note `url` is optional when using an API key, but keeping it avoids version/platform edge cases.)

## Data Model Expectations

- `webhook_events` has a unique index on `eventId`.
- `subscriptions` has a unique index on `userId` OR we use `userId` as the documentId for natural upsert.

## Behavior

### 1. Verify Signature

- Compute `computed = HMAC_SHA256_HEX(SELLAPP_WEBHOOK_SECRET, req.bodyText)`.
- Compare using timing-safe comparison.
- If invalid: return `{ ok: false, error: "invalid_signature" }`.

### 2. Parse Payload

- Prefer `req.bodyJson` but fall back to `JSON.parse(req.bodyText)`.
- If invalid JSON: `{ ok: false, error: "invalid_json" }`.

### 3. Idempotency Guard (Create Webhook Event)

- Derive a stable `eventId` string (current approach: `${event}:${orderId}:${store}` with fallbacks).
- Create a document in `webhook_events` with:
  - `documentId`: `sha256(eventId).slice(0, 36)` (hex is Appwrite-safe)
  - `data`: `{ provider, eventId, orderId, payloadHash, processedAt }`
- If create returns conflict (`409`): treat as duplicate and return `{ ok: true, duplicate: true }`.

### 4. Map Event to Action

- `order.completed` => subscription `active` + grant paid team
- `order.disputed` => subscription `inactive` + revoke paid team
- Unknown event: return `{ ok: true, recorded: true, unhandledEvent: <event> }`

### 5. Resolve User by Email

- Extract email from multiple possible Sell.app payload locations.
- Find user via REST:
  - `GET /users?search=<email>` with API key auth
  - Pick exact match case-insensitively.
- If no email or user not found: return `{ ok: true, warning: "no_email_in_payload" | "user_not_found" }`.

### 6. Upsert Subscription

- Use REST upsert for `subscriptions` where `documentId = userId`.

Option A (preferred):
- `PUT /databases/{db}/collections/{subscriptions}/documents/{userId}` with `{ data: { userId, status, plan, sellappOrderId, currentPeriodEnd } }`

Option B (fallback if PUT not available):
- `POST` create with `documentId=userId`, on `409` do `PATCH/PUT` update.

### 7. Grant/Revoke Paid Team

- To grant:
  - List memberships: `GET /teams/{paid}/memberships` (paginate with limit+offset queries if needed)
  - If user already a member: no-op
  - Else create membership: `POST /teams/{paid}/memberships` with `{ userId, roles: ["member"], name, url: APP_BASE_URL }`

- To revoke:
  - List memberships and find one with `userId`
  - If found: `DELETE /teams/{paid}/memberships/{membershipId}`

## Error Handling

- Always return a JSON object with `{ ok: boolean, ... }`.
- Do not leak internal errors to the webhook caller.
- Log enough details via `log`/`error` for debugging (eventId, status codes), but never log secrets.

## Security Notes

- Signature verification must use the raw body (`req.bodyText`).
- Treat all payload fields as untrusted.
- API key must be scoped to only what the function needs (Users read, Teams memberships, Databases read/write for the two collections).

## Verification (When Implemented)

- `pnpm -w typecheck`
- Deploy: `pnpm appwrite:deploy:sellapp-webhook`
- Trigger an HTTP call with valid signature and confirm:
  - first call returns `{ ok: true }`
  - second call returns `{ ok: true, duplicate: true }`
  - user is added to `paid` team and `subscriptions` doc exists

