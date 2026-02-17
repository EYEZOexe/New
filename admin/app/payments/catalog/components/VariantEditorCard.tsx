import Link from "next/link";

import type {
  FlattenedCatalogVariant,
  PolicyRow,
  PolicyScope,
  SubscriptionTier,
} from "../types";
import { formatPolicyOptionValue } from "../utils";

type VariantEditorCardProps = {
  flattenedVariants: FlattenedCatalogVariant[];
  selectedVariantId: string;
  onSelectedVariantChange: (value: string) => void;
  storefrontUrl: string;
  onStorefrontUrlChange: (value: string) => void;
  policyScope: PolicyScope;
  onPolicyScopeChange: (value: PolicyScope) => void;
  scopePolicies: PolicyRow[];
  selectedPolicyExternalId: string;
  onSelectPolicy: (value: string) => void;
  selectedPolicy: PolicyRow | null;
  variantTier: SubscriptionTier;
  onVariantTierChange: (value: SubscriptionTier) => void;
  durationDays: string;
  onDurationDaysChange: (value: string) => void;
  displayPrice: string;
  onDisplayPriceChange: (value: string) => void;
  priceSuffix: string;
  onPriceSuffixChange: (value: string) => void;
  highlightsText: string;
  onHighlightsTextChange: (value: string) => void;
  useCustomCheckoutUrl: boolean;
  onUseCustomCheckoutUrlChange: (value: boolean) => void;
  customCheckoutUrl: string;
  onCustomCheckoutUrlChange: (value: string) => void;
  checkoutPreview: string;
  variantSortOrder: string;
  onVariantSortOrderChange: (value: string) => void;
  isFeatured: boolean;
  onIsFeaturedChange: (value: boolean) => void;
  variantActive: boolean;
  onVariantActiveChange: (value: boolean) => void;
  isSavingVariant: boolean;
  onSaveVariant: () => void;
  onRemoveSelected: () => void;
};

export function VariantEditorCard(props: VariantEditorCardProps) {
  return (
    <div className="admin-surface-soft space-y-4">
      <h2 className="text-sm font-semibold text-slate-100">Tier variants</h2>
      <label className="admin-label">
        Edit existing variant
        <select
          className="admin-input"
          value={props.selectedVariantId}
          onChange={(event) => props.onSelectedVariantChange(event.target.value)}
        >
          <option value="">Create new variant</option>
          {props.flattenedVariants.map((variant) => (
            <option key={variant._id} value={variant._id}>
              {variant.tier.toUpperCase()} {variant.durationDays}d - {variant.displayPrice}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-label">
        Sell storefront URL
        <input
          className="admin-input"
          value={props.storefrontUrl}
          onChange={(event) => props.onStorefrontUrlChange(event.target.value)}
          placeholder="https://your-store.sell.app"
        />
      </label>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => props.onPolicyScopeChange("product")}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition ${
              props.policyScope === "product"
                ? "bg-cyan-500 text-slate-950"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            Product policy
          </button>
          <button
            type="button"
            onClick={() => props.onPolicyScopeChange("variant")}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition ${
              props.policyScope === "variant"
                ? "bg-cyan-500 text-slate-950"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            Variant policy
          </button>
        </div>
        <label className="admin-label mt-3">
          Linked policy
          <select
            className="admin-input"
            value={
              props.selectedPolicyExternalId
                ? formatPolicyOptionValue(props.policyScope, props.selectedPolicyExternalId)
                : ""
            }
            onChange={(event) => props.onSelectPolicy(event.target.value)}
          >
            <option value="">Select enabled policy</option>
            {props.scopePolicies.map((policy) => (
              <option
                key={`${policy.scope}:${policy.externalId}`}
                value={formatPolicyOptionValue(policy.scope, policy.externalId)}
              >
                {policy.externalId} - {policy.tier} / {policy.durationDays ?? "n/a"}d
              </option>
            ))}
          </select>
        </label>
        {props.selectedPolicy ? (
          <p className="mt-2 text-xs text-slate-400">
            Enforces {props.selectedPolicy.tier} for {props.selectedPolicy.durationDays ?? "n/a"}d.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-300">
            No enabled policy selected. Configure one in{" "}
            <Link href="/payments/policies" className="underline">
              access policies
            </Link>
            .
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Tip: product policy external IDs can use <code>productId|slug</code> (for example{" "}
          <code>349820|basic-plan</code>) so webhook matching keeps the numeric ID while checkout
          URLs use the storefront slug.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="admin-label">
          Tier
          <select
            className="admin-input"
            value={props.variantTier}
            onChange={(event) => props.onVariantTierChange(event.target.value as SubscriptionTier)}
          >
            <option value="basic">basic</option>
            <option value="advanced">advanced</option>
            <option value="pro">pro</option>
          </select>
        </label>
        <label className="admin-label">
          Duration days
          <input
            className="admin-input"
            value={props.durationDays}
            onChange={(event) => props.onDurationDaysChange(event.target.value)}
          />
        </label>
        <label className="admin-label">
          Display price
          <input
            className="admin-input"
            value={props.displayPrice}
            onChange={(event) => props.onDisplayPriceChange(event.target.value)}
            placeholder="$199"
          />
        </label>
        <label className="admin-label">
          Price suffix
          <input
            className="admin-input"
            value={props.priceSuffix}
            onChange={(event) => props.onPriceSuffixChange(event.target.value)}
            placeholder="/month"
          />
        </label>
        <label className="admin-label md:col-span-2">
          Highlights (one per line)
          <textarea
            className="admin-textarea"
            value={props.highlightsText}
            onChange={(event) => props.onHighlightsTextChange(event.target.value)}
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <input
            type="checkbox"
            checked={props.useCustomCheckoutUrl}
            onChange={(event) => props.onUseCustomCheckoutUrlChange(event.target.checked)}
          />
          Use custom checkout URL override
        </label>
        {props.useCustomCheckoutUrl ? (
          <label className="admin-label mt-3">
            Custom checkout URL
            <input
              className="admin-input"
              value={props.customCheckoutUrl}
              onChange={(event) => props.onCustomCheckoutUrlChange(event.target.value)}
              placeholder="https://..."
            />
          </label>
        ) : (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Auto checkout URL</p>
            <p className="mt-1 break-all text-sm font-medium text-slate-200">
              {props.checkoutPreview || "No auto URL available for the current setup."}
            </p>
            {props.policyScope === "variant" ? (
              <p className="mt-2 text-xs text-amber-300">
                Variant policies need custom checkout URL override, or switch to product policy
                for automatic checkout URL generation.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="admin-label">
          Sort order
          <input
            className="admin-input w-28"
            value={props.variantSortOrder}
            onChange={(event) => props.onVariantSortOrderChange(event.target.value)}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-300">
          <input
            type="checkbox"
            checked={props.isFeatured}
            onChange={(event) => props.onIsFeaturedChange(event.target.checked)}
          />
          Featured
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-300">
          <input
            type="checkbox"
            checked={props.variantActive}
            onChange={(event) => props.onVariantActiveChange(event.target.checked)}
          />
          Active
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={props.onSaveVariant}
          disabled={props.isSavingVariant}
          className="admin-btn-primary"
        >
          {props.isSavingVariant ? "Saving..." : "Save variant"}
        </button>
        {props.selectedVariantId ? (
          <button type="button" onClick={props.onRemoveSelected} className="admin-btn-secondary">
            Remove selected
          </button>
        ) : null}
      </div>
    </div>
  );
}
