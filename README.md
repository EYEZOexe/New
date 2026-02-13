# G3netic Crypto Signals (Monorepo)

This repository contains the monorepo for a single-seller “signals” SaaS:

- `crypto.g3netic.com` → Marketing site + auth + purchases + **/dashboard**
- `admin-crypto.g3netic.com` → Admin panel
- Discord mirror bot → Mirrors signals from a source Discord guild into a customer guild
- Backend → Self-hosted **Appwrite** (deployed separately in Coolify) at `appwrite.g3netic.com`

## Apps

- `apps/web` (Next.js) → marketing + dashboard
- `apps/admin` (Next.js) → admin UI
- `apps/bot` (Node/TS) → Discord bot service

## Packages

- `packages/shared` → shared types + zod schemas
- `packages/appwrite` → Appwrite client wrappers

## Local setup (dev)

Prereqs: Node 20+, pnpm

```bash
pnpm install
pnpm dev
```

### Per-app dev

```bash
pnpm --filter @g3netic/web dev
pnpm --filter @g3netic/admin dev
pnpm --filter @g3netic/bot dev
```

## Environment variables

Each app has its own `.env.example`.

## Deployment (Coolify)

This repo includes Dockerfiles per service (recommended build context: **repo root**):

- `apps/web/Dockerfile`
- `apps/admin/Dockerfile`
- `apps/bot/Dockerfile`

Additionally, for easier Coolify configuration you can point directly to the root Dockerfiles:

- `Dockerfile.web`
- `Dockerfile.admin`
- `Dockerfile.bot`

Coolify services should set the appropriate domain(s) and environment variables.

### Important: Build context / base directory
If Coolify is configured with **Base Directory = `apps/admin`** (or `apps/web`), Docker will NOT be able to `COPY packages/*` and the build will fail.

Set **Base Directory / Build Context** to the **repository root**, and select either:
- `Dockerfile.admin` / `Dockerfile.web` / `Dockerfile.bot`, or
- `apps/admin/Dockerfile` / `apps/web/Dockerfile` / `apps/bot/Dockerfile`.
