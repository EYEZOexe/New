# G3netic Crypto Signals (Monorepo)

This repository contains the monorepo for a single-seller "signals" SaaS:

- `crypto.g3netic.com` -> Marketing site + auth + purchases + `/dashboard`
- `admin-crypto.g3netic.com` -> Admin panel
- Discord mirror bot -> Mirrors signals from a source Discord guild into a customer guild
- Backend -> Convex (this repo is the source of truth for schema and server functions)

## Apps

- `apps/web` (Next.js) -> marketing + dashboard
- `apps/admin` (Next.js) -> admin UI
- `apps/bot` (Node/TS) -> Discord bot service

## Packages

- `packages/shared` -> shared types + schemas

## Local Setup (Dev)

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

## Environment Variables

Each app has its own `.env.example`.

## Deployment

This repo includes Dockerfiles per service (recommended build context: repo root):

- `apps/web/Dockerfile`
- `apps/admin/Dockerfile`
- `apps/bot/Dockerfile`

Additionally, for easier Coolify configuration you can point directly to the root Dockerfiles:

- `Dockerfile.web`
- `Dockerfile.admin`
- `Dockerfile.bot`

### Important: Build Context / Base Directory

If Coolify is configured with Base Directory = `apps/admin` (or `apps/web`), Docker will not be able
to `COPY packages/*` and the build can fail.

Set Base Directory / Build Context to the repository root, and select either:

- `Dockerfile.admin` / `Dockerfile.web` / `Dockerfile.bot`, or
- `apps/admin/Dockerfile` / `apps/web/Dockerfile` / `apps/bot/Dockerfile`.

## Roadmap

Source of truth: `docs/roadmap.md`

