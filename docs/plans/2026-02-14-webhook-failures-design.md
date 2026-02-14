# Webhook Failure Capture + Replay (Sell.app)

Date: 2026-02-14

## Goal

When the Sell.app webhook handler fails to apply side effects (grant/revoke paid access), record enough context to:

- diagnose the failure
- **replay** the exact webhook payload through the same public URL

Retention requirement: keep failure records for **7 days**, then delete automatically.

## Constraints / Decisions

- Appwrite is self-hosted (`appwrite.g3netic.com`) currently running `1.7.4`.
- Webhook delivery URL is the Cloudflare Worker proxy:
  - `https://webhooks.g3netic.com/sell/webhook`
- Appwrite Function domains are not required for this design.
- Webhook signature verification is `HMAC-SHA256(secret, rawBody)` hex in the `signature` header.
- Failure capture must not store secrets (Appwrite API key, webhook secret).

## Data Model

New Appwrite collection (stable IDs):

- DB: `crypto`
- Collection: `webhook_failures`

Failure document fields (best-effort):

- `provider`: `"sellapp"`
- `event`: Sell.app event name (e.g. `order.completed`)
- `eventId`: the handler idempotency key (`${event}:${orderId}:${store}`)
- `orderId`, `store`, `email`
- `payloadHash`: sha256 of `bodyText`
- `bodyText`: raw request body (exact JSON string)
- `errorCode`: short internal code (e.g. `user_not_found`, `appwrite_error`)
- `errorMessage`, `errorStatus`, `errorType`

Permissions:

- Admin-only read/write at the collection level (operational data).

## Write Behavior

- Only write failure records **after signature verification** succeeds.
- Record failures for:
  - internal errors calling Appwrite (network/HTTP errors)
  - `warning` paths that indicate missed side-effects (e.g. `user_not_found`, `no_email_in_payload`)
  - JSON parse errors when signature is valid
- Do not record duplicates (`duplicate: true` from `webhook_events` idempotency).
- Failure write is best-effort: webhook processing should not crash if failure logging fails.

## Replay

Add a CLI script that:

1. Fetches a `webhook_failures` doc by id.
2. Recomputes signature using `SELLAPP_WEBHOOK_SECRET` and stored `bodyText`.
3. POSTs to `https://webhooks.g3netic.com/sell/webhook`.

## Retention (7 days)

Appwrite has no TTL per document. Enforce retention via a scheduled Appwrite Function:

- Function: `prune-webhook-failures`
- Schedule: daily (off-peak)
- Deletes documents older than 7 days using Appwrite bulk delete (`DELETE /databases/{db}/collections/{col}/documents` with queries).

## Verification

- Unit tests:
  - webhook handler records failures for warning/error paths
  - prune function generates correct cutoff and issues bulk delete
- Integration:
  - force a controlled failure (e.g., webhook for non-existent user) and confirm:
    - `webhook_failures` doc created with raw body
    - replay script re-sends successfully once the user exists
  - confirm prune job deletes a doc older than 7 days (in a sandbox or via temporary test docs)

