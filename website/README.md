This is a [Next.js](https://nextjs.org) app with Convex Auth email/password login and signup.

## Environment

Create `.env.local` from `.env.example` and set:

```bash
# Convex Cloud origin (backend/data API)
NEXT_PUBLIC_CONVEX_URL=https://convex-backend.g3netic.com
CONVEX_SELF_HOSTED_URL=https://convex-backend.g3netic.com
CONVEX_SELF_HOSTED_ADMIN_KEY=__SET_ME__
# Convex Auth/OIDC origin for self-hosted HTTP actions (note the /http prefix)
CONVEX_SITE_URL=https://convex-backend.g3netic.com/http
NEXT_PUBLIC_CONVEX_SITE_URL=https://convex-backend.g3netic.com/http
# Public website/dashboard origin for OAuth callback construction fallback
NEXT_PUBLIC_APP_URL=https://convex.g3netic.com

# Discord OAuth linking (dashboard -> Discord -> callback)
DISCORD_CLIENT_ID=__SET_ME__
DISCORD_CLIENT_SECRET=__SET_ME__
# Optional explicit callback URL override; defaults to:
# ${NEXT_PUBLIC_APP_URL}/api/auth/discord/callback
DISCORD_REDIRECT_URI=https://convex.g3netic.com/api/auth/discord/callback

# Sell.app webhook ingestion + ops replay
SELLAPP_WEBHOOK_SECRET=__SET_ME__
SELLAPP_REPLAY_TOKEN=__SET_ME__
SELLAPP_API_TOKEN=__SET_ME__
# Optional fallback if payment methods cannot be discovered from Sell variants
SELLAPP_DEFAULT_PAYMENT_METHODS=STRIPE,PAYPAL

# Discord role sync queue (Convex backend + Discord-Bot worker)
ROLE_SYNC_BOT_TOKEN=__SET_ME__

# Optional legacy fallback single role if tier mapping is missing
DISCORD_CUSTOMER_GUILD_ID=__SET_ME__
DISCORD_CUSTOMER_ROLE_ID=__SET_ME__
```

Domain mapping in this project:
- `https://convex-backend.g3netic.com` = Convex Cloud/backend origin
- `https://convex-backend.g3netic.com/http` = Convex Auth/OIDC HTTP routes
- `https://convex.g3netic.com` = Convex dashboard UI

Webhook endpoints (Convex HTTP actions):
- `POST /webhooks/sellapp` (Sell.app delivery + idempotent processing)
- `POST /webhooks/sellapp/replay` (manual replay, requires `SELLAPP_REPLAY_TOKEN`)
- `GET /webhooks/sellapp/failures` (failed event inbox, requires `SELLAPP_REPLAY_TOKEN`)

Discord linking endpoints (Next.js routes):
- `GET /api/auth/discord/start` (starts OAuth with state cookie)
- `GET /api/auth/discord/callback` (OAuth callback; stores pending link cookie)
- `POST /api/auth/discord/complete` (consumes pending cookie for authenticated dashboard link mutation)

Role sync queue functions:
- `roleSync:claimPendingRoleSyncJobs` (bot worker claims pending jobs with token)
- `roleSync:completeRoleSyncJob` (bot worker ACKs success/failure)
- `roleSync:listRoleSyncJobs` (operator visibility query)

Sell access policy functions:
- `sellAccessPolicies:listSellAccessPolicies`
- `sellAccessPolicies:upsertSellAccessPolicy`
- `sellAccessPolicies:removeSellAccessPolicy`

Operational admin pages:
- `admin:/payments/policies` maps product/variant -> tier + fixed-term duration days.
- `admin:/discord` maps tier -> Discord role.

Important:
- `NEXT_PUBLIC_CONVEX_URL` must be backend origin without `/http`.
- `CONVEX_SITE_URL` should use backend `/http` origin for self-hosted auth routes.

## Convex Backend

This app uses Convex backend code from the repo root `convex/` directory.

To push schema/functions to your self-hosted Convex instance:

```bash
bunx convex dev --once
```

For self-hosted deployments, Convex CLI requires both:
- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`

To configure fallback Sell payment methods from terminal:

```bash
npx convex env set SELLAPP_DEFAULT_PAYMENT_METHODS STRIPE,PAYPAL
```

If auth signs in but the app immediately shows signed out, verify issuer/jwks:

```bash
curl https://convex-backend.g3netic.com/http/.well-known/openid-configuration
```

Expected `issuer`:
- `https://convex-backend.g3netic.com/http`

If issuer is wrong, fix your self-hosted Convex service-level site origin so the
built-in `CONVEX_SITE_URL` resolves to backend `/http`, then redeploy/restart
the Convex backend service.

After updating env vars, verify auth endpoints:

```bash
curl https://convex-backend.g3netic.com/http/.well-known/openid-configuration
curl https://convex-backend.g3netic.com/http/.well-known/jwks.json
```

## Getting Started

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
