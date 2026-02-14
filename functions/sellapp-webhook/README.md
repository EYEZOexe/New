# sell.app webhook (Legacy)

This folder contains a legacy webhook handler that was previously deployed as an external function.

The backend is now pivoting to Convex. This legacy handler is expected to be replaced by a Convex
HTTP endpoint (or an equivalent Convex ingestion path) and then removed.

Plan of record: `docs/plans/2026-02-14-convex-adoption-plan.md`

## What it does

- Validates Sell.app `signature` header (HMAC-SHA256 of raw body).
- Writes an idempotency record.
- Upserts subscription state.
- (Legacy) Performs access gating side effects that will move into Convex.

## Status

Do not extend this code path. Use it only as a reference during the Convex migration.

## Test / Replay Locally

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
