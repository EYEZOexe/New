import Link from "next/link";

type CatalogHeroProps = {
  tierCount: number;
  variantCount: number;
  activeVariantCount: number;
  message: string | null;
  error: string | null;
};

export function CatalogHero(props: CatalogHeroProps) {
  return (
    <div className="admin-surface border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/70 to-indigo-100/80 shadow-[0_35px_90px_-50px_rgba(15,23,42,0.85)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-chip bg-white/85">Payments</p>
          <h1 className="admin-title mt-3">Shop Catalog Control Room</h1>
          <p className="admin-subtitle max-w-2xl">
            Manage tier merchandising and per-tier duration variants with automatic checkout URLs
            from selected Sell product policies.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="admin-link">
            Home
          </Link>
          <Link href="/payments/policies" className="admin-link">
            Access policies
          </Link>
          <Link href="/payments/customers" className="admin-link">
            Payment customers
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tiers</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{props.tierCount}</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Variants</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{props.variantCount}</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{props.activeVariantCount}</p>
        </div>
      </div>

      {props.message ? <p className="mt-4 text-sm text-emerald-700">{props.message}</p> : null}
      {props.error ? <p className="mt-4 text-sm text-red-700">{props.error}</p> : null}
    </div>
  );
}
