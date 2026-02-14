# prune-webhook-failures (Legacy)

Legacy scheduled job that pruned old webhook failure records for the previous backend.

As part of the Convex pivot, webhook failures should be stored in Convex and pruned via a Convex
scheduled function (or a periodic job) instead.

Plan of record: `docs/plans/2026-02-14-convex-adoption-plan.md`

## Status

Do not extend this code path. Replace it with a Convex-native job and then remove it.
