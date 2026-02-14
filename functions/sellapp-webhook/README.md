# sell.app webhook (Appwrite Function)

This Appwrite Function processes Sell.app webhooks **even if the website is down**.

## What it does

- Validates Sell.app `signature` header (HMAC-SHA256 of raw body).
- Writes an idempotency record into `webhook_events`.
- Upserts a `subscriptions` document (by `userId`).
- Adds/removes the user from the `paid` Appwrite team.
- Uses Appwrite **REST** APIs (no `node-appwrite` SDK inside the Function).

## Required env vars (Function variables)

- `SELLAPP_WEBHOOK_SECRET`
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY` (server key with Users/Teams/Databases permissions)
- `APPWRITE_DATABASE_ID=crypto`
- `APPWRITE_SUBSCRIPTIONS_COLLECTION_ID=subscriptions`
- `APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID=webhook_events`
- `APPWRITE_TEAM_PAID_ID=paid` (optional but recommended)
- `APP_BASE_URL=https://yourdomain.com` (optional; used as the team invite redirect URL when adding membership)

## Deploy (high level)

1) Create a Function in Appwrite Console using a Node runtime.
2) Set **Execute access = Any**.
3) Upload this folder as deployment (or connect VCS).
4) Set the env vars above.
5) Use the Function HTTP domain URL as the Sell.app webhook target.

## Test / replay locally

You can validate the signature logic with a simple curl, and you can run unit tests locally.

### Unit tests

```bash
cd functions/sellapp-webhook
npm test
```

### Curl replay

1) Create a JSON payload:

```bash
echo {"event":"order.completed","data":{"id":123,"email":"customer@example.com"},"store":1} > payload.json
```

2) Compute signature (HMAC-SHA256 hex) using the same secret configured in Sell.app:

```bash
node -e "const fs=require('fs');const crypto=require('crypto');const secret=process.env.SELLAPP_WEBHOOK_SECRET;const body=fs.readFileSync('payload.json','utf8');console.log(crypto.createHmac('sha256', secret).update(body).digest('hex'))"
```

3) POST to your function domain:

```bash
curl -X POST https://<FUNCTION_DOMAIN>/ \
  -H "Content-Type: application/json" \
  -H "signature: <PASTE_SIGNATURE_HEX>" \
  --data-binary @payload.json
```

Expected response:
- `{ "ok": true }` on first call
- `{ "ok": true, "duplicate": true }` on second call (idempotency)
