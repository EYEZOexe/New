import type { FlattenedCatalogVariant } from "../types";

type VariantsTableProps = {
  catalogLoaded: boolean;
  flattenedVariants: FlattenedCatalogVariant[];
  onEditVariant: (variantId: string) => void;
  onToggleVariantActive: (variantId: string, active: boolean) => void;
  onRemoveVariant: (variantId: string) => void;
};

function getTierPillClass(tier: FlattenedCatalogVariant["tier"]): string {
  if (tier === "basic") return "bg-cyan-100 text-cyan-800";
  if (tier === "advanced") return "bg-amber-100 text-amber-800";
  return "bg-fuchsia-100 text-fuchsia-800";
}

export function VariantsTable(props: VariantsTableProps) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2">Duration</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Policy</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {!props.catalogLoaded && (
            <tr>
              <td className="px-3 py-4 text-slate-600" colSpan={6}>
                Loading catalog...
              </td>
            </tr>
          )}
          {props.catalogLoaded && props.flattenedVariants.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-slate-600" colSpan={6}>
                No variants configured yet.
              </td>
            </tr>
          )}
          {props.flattenedVariants.map((variant) => (
            <tr key={variant._id}>
              <td className="px-3 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getTierPillClass(variant.tier)}`}>
                  {variant.tier}
                </span>{" "}
                <span className="text-xs text-slate-500">({variant.tierTitle})</span>
              </td>
              <td className="px-3 py-3">{variant.durationDays} days</td>
              <td className="px-3 py-3">
                {variant.displayPrice}
                {variant.priceSuffix ? ` ${variant.priceSuffix}` : ""}
              </td>
              <td className="px-3 py-3 text-xs">
                {variant.policyScope}:{variant.policyExternalId}
              </td>
              <td className="px-3 py-3">
                {variant.active ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    active
                  </span>
                ) : (
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    inactive
                  </span>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold underline"
                    onClick={() => props.onEditVariant(variant._id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold underline"
                    onClick={() => props.onToggleVariantActive(variant._id, !variant.active)}
                  >
                    Set {variant.active ? "inactive" : "active"}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold underline"
                    onClick={() => props.onRemoveVariant(variant._id)}
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
