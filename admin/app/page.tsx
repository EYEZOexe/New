import Link from "next/link";

const NAV_CARDS = [
  {
    href: "/connectors",
    title: "Connectors",
    description: "Source and target channel mappings, runtime controls, and mirroring health.",
  },
  {
    href: "/payments/policies",
    title: "Access Policies",
    description: "Enforcement mappings from Sell products/variants to fixed-term tiers.",
  },
  {
    href: "/payments/catalog",
    title: "Catalog",
    description: "Tier-first merchandising with per-tier duration variants and policy links.",
  },
  {
    href: "/payments/customers",
    title: "Payment Customers",
    description: "Customer identity, linkage metadata, and subscription troubleshooting data.",
  },
  {
    href: "/discord",
    title: "Discord Roles",
    description: "Tier role mapping and role-sync runtime visibility for support operations.",
  },
];

export default function Home() {
  return (
    <main className="admin-shell">
      <section className="admin-wrap">
        <div className="admin-surface">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="admin-chip">Admin Control Plane</p>
              <h1 className="admin-title mt-3">Operations Dashboard</h1>
              <p className="admin-subtitle max-w-2xl">
                Monitor storefront configuration, subscription enforcement, and Discord
                delivery from one interface with realtime Convex-backed state.
              </p>
            </div>
            <div className="admin-surface-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Focus
              </p>
              <p className="mt-2 text-sm text-slate-800">
                Keep customer-facing catalog polished while preserving strict policy-linked
                entitlement controls.
              </p>
            </div>
          </div>

          <div className="mt-6 admin-grid">
            {NAV_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="admin-surface-soft block transition hover:border-slate-400 hover:bg-white"
              >
                <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                <p className="mt-2 text-sm text-slate-600">{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
