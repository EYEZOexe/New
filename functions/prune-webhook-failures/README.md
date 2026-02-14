# prune-webhook-failures

Scheduled Appwrite Function that deletes `webhook_failures` documents older than 7 days.

## Required env vars

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`

## Optional env vars (stable defaults)

- `APPWRITE_DATABASE_ID=crypto`
- `APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID=webhook_failures`
- `WEBHOOK_FAILURE_RETENTION_DAYS=7`

