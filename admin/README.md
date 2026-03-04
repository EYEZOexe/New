# Admin App

Next.js admin surface for operational configuration and support views.

## Environment

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://convex-backend.g3netic.com
```

## Available Routes

- `/mappings`: manage connector lifecycle, channel mapping, and bot mirroring toggle/queue visibility.
- `/filtering`: configure per-mapping message filtering (allow/block URL domains and keywords).
- `/payments/customers`: inspect Sell customer/subscription linkage.
- `/payments/policies`: map Sell product/variant IDs to tier and fixed-term duration.
- `/discord-bot`: configure tier-to-role mapping for `basic`, `advanced`, and `pro`.

## Run

```bash
bun install
bun run dev
```

## Verify

```bash
bun run typecheck
bun run build
```
