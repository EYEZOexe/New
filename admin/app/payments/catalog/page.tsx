"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SubscriptionTier = "basic" | "advanced" | "pro";
type PolicyScope = "product" | "variant";

type CatalogError = {
  code: string;
  message: string;
};

type CatalogVariant = {
  _id: string;
  tier: SubscriptionTier;
  durationDays: number;
  displayPrice: string;
  priceSuffix: string | null;
  checkoutUrl: string;
  highlights: string[];
  isFeatured: boolean;
  sortOrder: number | null;
  active: boolean;
  policyScope: PolicyScope;
  policyExternalId: string;
  updatedAt: number;
};

type CatalogTier = {
  _id: string;
  tier: SubscriptionTier;
  title: string;
  subtitle: string | null;
  badge: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  updatedAt: number;
  variants: CatalogVariant[];
};

type CatalogQueryResult = {
  tiers: CatalogTier[];
};

type UpsertTierResult = { ok: true; tierId: string } | { ok: false; error: CatalogError };
type UpsertVariantResult =
  | { ok: true; variantId: string }
  | { ok: false; error: CatalogError };
type RemoveVariantResult = { ok: true; removed: true } | { ok: false; error: CatalogError };
type SetVariantActiveResult =
  | { ok: true; variantId: string; active: boolean }
  | { ok: false; error: CatalogError };

function formatCatalogError(result: { error: CatalogError }): string {
  return `${result.error.code}: ${result.error.message}`;
}

export default function CatalogPage() {
  const listAdminRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, CatalogQueryResult>(
        "shopCatalog:listAdminShopCatalog",
      ),
    [],
  );
  const upsertTierRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          tier: SubscriptionTier;
          title: string;
          subtitle?: string;
          badge?: string;
          description?: string;
          sortOrder?: number;
          active?: boolean;
        },
        UpsertTierResult
      >("shopCatalog:upsertShopTier"),
    [],
  );
  const upsertVariantRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          variantId?: string;
          tier: SubscriptionTier;
          durationDays: number;
          displayPrice: string;
          priceSuffix?: string;
          checkoutUrl: string;
          highlights?: string[];
          isFeatured?: boolean;
          sortOrder?: number;
          active?: boolean;
          policyScope: PolicyScope;
          policyExternalId: string;
        },
        UpsertVariantResult
      >("shopCatalog:upsertShopVariant"),
    [],
  );
  const removeVariantRef = useMemo(
    () =>
      makeFunctionReference<"mutation", { variantId: string }, RemoveVariantResult>(
        "shopCatalog:removeShopVariant",
      ),
    [],
  );
  const setVariantActiveRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { variantId: string; active: boolean },
        SetVariantActiveResult
      >("shopCatalog:setShopVariantActive"),
    [],
  );

  const catalog = useQuery(listAdminRef, {});
  const upsertTier = useMutation(upsertTierRef);
  const upsertVariant = useMutation(upsertVariantRef);
  const removeVariant = useMutation(removeVariantRef);
  const setVariantActiveMutation = useMutation(setVariantActiveRef);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tier, setTier] = useState<SubscriptionTier>("basic");
  const [tierTitle, setTierTitle] = useState("");
  const [tierSubtitle, setTierSubtitle] = useState("");
  const [tierBadge, setTierBadge] = useState("");
  const [tierDescription, setTierDescription] = useState("");
  const [tierSortOrder, setTierSortOrder] = useState("1");
  const [tierActive, setTierActive] = useState(true);
  const [isSavingTier, setIsSavingTier] = useState(false);

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantTier, setVariantTier] = useState<SubscriptionTier>("basic");
  const [durationDays, setDurationDays] = useState("30");
  const [displayPrice, setDisplayPrice] = useState("$99");
  const [priceSuffix, setPriceSuffix] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("https://");
  const [highlightsText, setHighlightsText] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [variantSortOrder, setVariantSortOrder] = useState("");
  const [variantActive, setVariantActive] = useState(true);
  const [policyScope, setPolicyScope] = useState<PolicyScope>("variant");
  const [policyExternalId, setPolicyExternalId] = useState("");
  const [isSavingVariant, setIsSavingVariant] = useState(false);

  const flattenedVariants = useMemo(
    () =>
      (catalog?.tiers ?? [])
        .flatMap((catalogTier) =>
          catalogTier.variants.map((variant) => ({
            ...variant,
            tierTitle: catalogTier.title,
          })),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [catalog],
  );

  const selectedTierRow = useMemo(
    () => catalog?.tiers.find((row) => row.tier === tier),
    [catalog, tier],
  );
  const selectedVariant = useMemo(
    () => flattenedVariants.find((variant) => variant._id === selectedVariantId),
    [flattenedVariants, selectedVariantId],
  );

  useEffect(() => {
    if (!selectedTierRow) return;
    setTierTitle(selectedTierRow.title);
    setTierSubtitle(selectedTierRow.subtitle ?? "");
    setTierBadge(selectedTierRow.badge ?? "");
    setTierDescription(selectedTierRow.description ?? "");
    setTierSortOrder(String(selectedTierRow.sortOrder));
    setTierActive(selectedTierRow.active);
  }, [selectedTierRow]);

  useEffect(() => {
    if (!selectedVariant) return;
    setVariantTier(selectedVariant.tier);
    setDurationDays(String(selectedVariant.durationDays));
    setDisplayPrice(selectedVariant.displayPrice);
    setPriceSuffix(selectedVariant.priceSuffix ?? "");
    setCheckoutUrl(selectedVariant.checkoutUrl);
    setHighlightsText(selectedVariant.highlights.join("\n"));
    setIsFeatured(selectedVariant.isFeatured);
    setVariantSortOrder(
      selectedVariant.sortOrder === null ? "" : String(selectedVariant.sortOrder),
    );
    setVariantActive(selectedVariant.active);
    setPolicyScope(selectedVariant.policyScope);
    setPolicyExternalId(selectedVariant.policyExternalId);
  }, [selectedVariant]);

  async function onSaveTier() {
    setMessage(null);
    setError(null);
    setIsSavingTier(true);
    try {
      const sortOrderNumber = Number.parseInt(tierSortOrder.trim(), 10);
      const result = await upsertTier({
        tier,
        title: tierTitle,
        subtitle: tierSubtitle || undefined,
        badge: tierBadge || undefined,
        description: tierDescription || undefined,
        sortOrder: Number.isFinite(sortOrderNumber) ? sortOrderNumber : undefined,
        active: tierActive,
      });
      if (!result.ok) {
        setError(formatCatalogError(result));
        return;
      }
      setMessage(`Tier ${tier} saved.`);
      console.info(
        `[admin/catalog] tier saved tier=${tier} sort_order=${sortOrderNumber} active=${tierActive}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save tier";
      setError(text);
      console.error(`[admin/catalog] tier save failed: ${text}`);
    } finally {
      setIsSavingTier(false);
    }
  }

  async function onSaveVariant() {
    setMessage(null);
    setError(null);
    setIsSavingVariant(true);
    try {
      const parsedDuration = Number.parseInt(durationDays.trim(), 10);
      if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
        throw new Error("Duration days must be a positive integer.");
      }
      const parsedSortOrder = Number.parseInt(variantSortOrder.trim(), 10);
      const highlights = highlightsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const result = await upsertVariant({
        variantId: selectedVariantId || undefined,
        tier: variantTier,
        durationDays: parsedDuration,
        displayPrice,
        priceSuffix: priceSuffix || undefined,
        checkoutUrl,
        highlights: highlights.length > 0 ? highlights : undefined,
        isFeatured,
        sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined,
        active: variantActive,
        policyScope,
        policyExternalId,
      });
      if (!result.ok) {
        setError(formatCatalogError(result));
        return;
      }

      setMessage(
        selectedVariantId
          ? `Variant ${selectedVariantId} updated.`
          : `Variant ${result.variantId} created.`,
      );
      console.info(
        `[admin/catalog] variant saved variant=${result.variantId} tier=${variantTier} duration_days=${parsedDuration} active=${variantActive} policy_scope=${policyScope} policy_id=${policyExternalId}`,
      );
      if (!selectedVariantId) {
        setSelectedVariantId(result.variantId);
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save variant";
      setError(text);
      console.error(`[admin/catalog] variant save failed: ${text}`);
    } finally {
      setIsSavingVariant(false);
    }
  }

  async function onToggleVariantActive(variantId: string, active: boolean) {
    setMessage(null);
    setError(null);
    try {
      const result = await setVariantActiveMutation({ variantId, active });
      if (!result.ok) {
        setError(formatCatalogError(result));
        return;
      }
      setMessage(`Variant ${variantId} is now ${active ? "active" : "inactive"}.`);
      console.info(`[admin/catalog] variant active toggle variant=${variantId} active=${active}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to update variant status";
      setError(text);
      console.error(`[admin/catalog] variant toggle failed: ${text}`);
    }
  }

  async function onRemoveVariant(variantId: string) {
    setMessage(null);
    setError(null);
    try {
      const result = await removeVariant({ variantId });
      if (!result.ok) {
        setError(formatCatalogError(result));
        return;
      }
      if (selectedVariantId === variantId) {
        setSelectedVariantId("");
      }
      setMessage(`Variant ${variantId} removed.`);
      console.info(`[admin/catalog] variant removed variant=${variantId}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to remove variant";
      setError(text);
      console.error(`[admin/catalog] variant remove failed: ${text}`);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-wrap">
        <div className="admin-surface">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="admin-chip">Payments</p>
              <h1 className="admin-title mt-3">Shop Catalog</h1>
              <p className="admin-subtitle max-w-2xl">
                Manage tier merchandising and per-tier duration variants while preserving strict
                links to enabled Sell access policies.
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

          {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="admin-surface-soft space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Tier cards</h2>
              <label className="admin-label">
                Tier
                <select
                  className="admin-input"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as SubscriptionTier)}
                >
                  <option value="basic">basic</option>
                  <option value="advanced">advanced</option>
                  <option value="pro">pro</option>
                </select>
              </label>
              <label className="admin-label">
                Title
                <input
                  className="admin-input"
                  value={tierTitle}
                  onChange={(e) => setTierTitle(e.target.value)}
                  placeholder="Starter"
                />
              </label>
              <label className="admin-label">
                Subtitle
                <input
                  className="admin-input"
                  value={tierSubtitle}
                  onChange={(e) => setTierSubtitle(e.target.value)}
                  placeholder="For swing traders"
                />
              </label>
              <label className="admin-label">
                Badge
                <input
                  className="admin-input"
                  value={tierBadge}
                  onChange={(e) => setTierBadge(e.target.value)}
                  placeholder="Most Popular"
                />
              </label>
              <label className="admin-label">
                Description
                <textarea
                  className="admin-textarea"
                  value={tierDescription}
                  onChange={(e) => setTierDescription(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="admin-label">
                  Sort order
                  <input
                    className="admin-input w-28"
                    value={tierSortOrder}
                    onChange={(e) => setTierSortOrder(e.target.value)}
                  />
                </label>
                <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={tierActive}
                    onChange={(e) => setTierActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
              <button
                type="button"
                onClick={() => void onSaveTier()}
                disabled={isSavingTier}
                className="admin-btn-primary"
              >
                {isSavingTier ? "Saving..." : "Save tier"}
              </button>
            </div>

            <div className="admin-surface-soft space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Tier variants</h2>
              <label className="admin-label">
                Edit existing variant
                <select
                  className="admin-input"
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                >
                  <option value="">Create new variant</option>
                  {flattenedVariants.map((variant) => (
                    <option key={variant._id} value={variant._id}>
                      {variant.tier.toUpperCase()} {variant.durationDays}d - {variant.displayPrice}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="admin-label">
                  Tier
                  <select
                    className="admin-input"
                    value={variantTier}
                    onChange={(e) => setVariantTier(e.target.value as SubscriptionTier)}
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
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                  />
                </label>
                <label className="admin-label">
                  Display price
                  <input
                    className="admin-input"
                    value={displayPrice}
                    onChange={(e) => setDisplayPrice(e.target.value)}
                    placeholder="$199"
                  />
                </label>
                <label className="admin-label">
                  Price suffix
                  <input
                    className="admin-input"
                    value={priceSuffix}
                    onChange={(e) => setPriceSuffix(e.target.value)}
                    placeholder="/month"
                  />
                </label>
                <label className="admin-label md:col-span-2">
                  Checkout URL
                  <input
                    className="admin-input"
                    value={checkoutUrl}
                    onChange={(e) => setCheckoutUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <label className="admin-label">
                  Policy scope
                  <select
                    className="admin-input"
                    value={policyScope}
                    onChange={(e) => setPolicyScope(e.target.value as PolicyScope)}
                  >
                    <option value="variant">variant</option>
                    <option value="product">product</option>
                  </select>
                </label>
                <label className="admin-label">
                  Policy external ID
                  <input
                    className="admin-input"
                    value={policyExternalId}
                    onChange={(e) => setPolicyExternalId(e.target.value)}
                  />
                </label>
                <label className="admin-label md:col-span-2">
                  Highlights (one per line)
                  <textarea
                    className="admin-textarea"
                    value={highlightsText}
                    onChange={(e) => setHighlightsText(e.target.value)}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="admin-label">
                  Sort order
                  <input
                    className="admin-input w-28"
                    value={variantSortOrder}
                    onChange={(e) => setVariantSortOrder(e.target.value)}
                  />
                </label>
                <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  Featured
                </label>
                <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={variantActive}
                    onChange={(e) => setVariantActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onSaveVariant()}
                  disabled={isSavingVariant}
                  className="admin-btn-primary"
                >
                  {isSavingVariant ? "Saving..." : "Save variant"}
                </button>
                {selectedVariantId ? (
                  <button
                    type="button"
                    onClick={() => void onRemoveVariant(selectedVariantId)}
                    className="admin-btn-secondary"
                  >
                    Remove selected
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border">
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
                {!catalog && (
                  <tr>
                    <td className="px-3 py-4 text-slate-600" colSpan={6}>
                      Loading catalog...
                    </td>
                  </tr>
                )}
                {flattenedVariants.length === 0 && catalog && (
                  <tr>
                    <td className="px-3 py-4 text-slate-600" colSpan={6}>
                      No variants configured yet.
                    </td>
                  </tr>
                )}
                {flattenedVariants.map((variant) => (
                  <tr key={variant._id}>
                    <td className="px-3 py-3">
                      {variant.tier} <span className="text-xs text-slate-500">({variant.tierTitle})</span>
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
                          onClick={() => setSelectedVariantId(variant._id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold underline"
                          onClick={() => void onToggleVariantActive(variant._id, !variant.active)}
                        >
                          Set {variant.active ? "inactive" : "active"}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold underline"
                          onClick={() => void onRemoveVariant(variant._id)}
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
        </div>
      </section>
    </main>
  );
}
