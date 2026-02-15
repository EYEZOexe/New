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
```

Domain mapping in this project:
- `https://convex-backend.g3netic.com` = Convex Cloud/backend origin
- `https://convex-backend.g3netic.com/http` = Convex Auth/OIDC HTTP routes
- `https://convex.g3netic.com` = Convex dashboard UI

Important:
- `NEXT_PUBLIC_CONVEX_URL` must be backend origin without `/http`.
- `CONVEX_SITE_URL` should use backend `/http` origin for self-hosted auth routes.

## Convex Backend

This app includes Convex backend code in `website/convex`.

To push schema/functions to your self-hosted Convex instance:

```bash
bunx convex dev --once
```

For self-hosted deployments, Convex CLI requires both:
- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`

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
