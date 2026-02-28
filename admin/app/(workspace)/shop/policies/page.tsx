"use client";

import { makeFunctionReference } from "convex/server";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type PolicyScope = "product" | "variant";
type Tier = "basic" | "advanced" | "pro";
type SellProductVisibility = "PUBLIC" | "ON_HOLD" | "HIDDEN" | "PRIVATE";

type PolicyRow = {
  scope: PolicyScope;
  externalId: string;
  tier: Tier;
  durationDays: number | null;
  enabled: boolean;
  updatedAt: number;
};

type SellProductRow = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  visibility: SellProductVisibility;
  url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function policyIdFromProduct(product: SellProductRow): string {
  return `${product.id}|${product.slug}`;
}

export default function ShopPoliciesPage() {
  const listPoliciesRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, PolicyRow[]>(
        "sellAccessPolicies:listSellAccessPolicies",
      ),
    [],
  );
  const upsertPolicyRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          scope: PolicyScope;
          externalId: string;
          tier: Tier;
          durationDays: number;
          enabled: boolean;
        },
        { ok: true }
      >("sellAccessPolicies:upsertSellAccessPolicy"),
    [],
  );
  const removePolicyRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { scope: PolicyScope; externalId: string },
        { ok: true; removed: boolean }
      >("sellAccessPolicies:removeSellAccessPolicy"),
    [],
  );
  const listSellProductsRef = useMemo(
    () =>
      makeFunctionReference<
        "action",
        { page?: number; limit?: number },
        { items: SellProductRow[] }
      >("sellProducts:listSellProducts"),
    [],
  );
  const createSellProductRef = useMemo(
    () =>
      makeFunctionReference<
        "action",
        { title: string; description: string; visibility?: SellProductVisibility },
        { product: SellProductRow }
      >("sellProducts:createSellProduct"),
    [],
  );
  const updateSellProductRef = useMemo(
    () =>
      makeFunctionReference<
        "action",
        {
          productId: number;
          title?: string;
          description?: string;
          visibility?: SellProductVisibility;
        },
        { product: SellProductRow }
      >("sellProducts:updateSellProduct"),
    [],
  );

  const rows = useQuery(listPoliciesRef, {});
  const upsertPolicy = useMutation(upsertPolicyRef);
  const removePolicy = useMutation(removePolicyRef);
  const listSellProducts = useAction(listSellProductsRef);
  const createSellProduct = useAction(createSellProductRef);
  const updateSellProduct = useAction(updateSellProductRef);

  const [scope, setScope] = useState<PolicyScope>("variant");
  const [externalId, setExternalId] = useState("");
  const [tier, setTier] = useState<Tier>("basic");
  const [durationDays, setDurationDays] = useState("30");
  const [enabled, setEnabled] = useState(true);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<SellProductRow[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productsMessage, setProductsMessage] = useState<string | null>(null);

  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductVisibility, setNewProductVisibility] = useState<SellProductVisibility>("HIDDEN");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingProductTitle, setEditingProductTitle] = useState("");
  const [editingProductDescription, setEditingProductDescription] = useState("");
  const [editingProductVisibility, setEditingProductVisibility] = useState<SellProductVisibility>("HIDDEN");
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);

  const loadSellProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setProductsError(null);
    try {
      const result = await listSellProducts({ page: 1, limit: 100 });
      setProducts(result.items);
      console.info(`[admin/shop] sell products loaded count=${result.items.length}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to load Sell products";
      setProductsError(text);
      console.error(`[admin/shop] sell products load failed: ${text}`);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [listSellProducts]);

  useEffect(() => {
    void loadSellProducts();
  }, [loadSellProducts]);

  function startEditProduct(product: SellProductRow) {
    setEditingProductId(product.id);
    setEditingProductTitle(product.title);
    setEditingProductDescription(product.description ?? "");
    setEditingProductVisibility(product.visibility);
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setEditingProductTitle("");
    setEditingProductDescription("");
    setEditingProductVisibility("HIDDEN");
  }

  async function onCreateProduct() {
    setIsCreatingProduct(true);
    setProductsError(null);
    setProductsMessage(null);
    try {
      const result = await createSellProduct({
        title: newProductTitle,
        description: newProductDescription,
        visibility: newProductVisibility,
      });
      setProductsMessage(`Created Sell product ${result.product.title} (${result.product.id}).`);
      setNewProductTitle("");
      setNewProductDescription("");
      setNewProductVisibility("HIDDEN");
      setScope("product");
      setExternalId(policyIdFromProduct(result.product));
      await loadSellProducts();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to create Sell product";
      setProductsError(text);
      console.error(`[admin/shop] create sell product failed: ${text}`);
    } finally {
      setIsCreatingProduct(false);
    }
  }

  async function onUpdateProduct() {
    if (!editingProductId) return;
    setIsUpdatingProduct(true);
    setProductsError(null);
    setProductsMessage(null);
    try {
      const result = await updateSellProduct({
        productId: editingProductId,
        title: editingProductTitle,
        description: editingProductDescription,
        visibility: editingProductVisibility,
      });
      setProductsMessage(`Updated Sell product ${result.product.title} (${result.product.id}).`);
      cancelEditProduct();
      await loadSellProducts();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to update Sell product";
      setProductsError(text);
      console.error(`[admin/shop] update sell product failed: ${text}`);
    } finally {
      setIsUpdatingProduct(false);
    }
  }

  async function onSavePolicy() {
    setIsSavingPolicy(true);
    setMessage(null);
    setError(null);
    try {
      const duration = Number.parseInt(durationDays.trim(), 10);
      if (!Number.isInteger(duration) || duration <= 0) {
        throw new Error("Duration days must be a positive integer.");
      }
      await upsertPolicy({
        scope,
        externalId,
        tier,
        durationDays: duration,
        enabled,
      });
      setMessage("Policy saved.");
      console.info(
        `[admin/shop] policy saved scope=${scope} id=${externalId} tier=${tier} duration_days=${duration} enabled=${enabled}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save policy";
      setError(text);
      console.error(`[admin/shop] policy save failed: ${text}`);
    } finally {
      setIsSavingPolicy(false);
    }
  }

  async function onRemovePolicy(row: PolicyRow) {
    setMessage(null);
    setError(null);
    try {
      await removePolicy({ scope: row.scope, externalId: row.externalId });
      setMessage(`Removed ${row.scope}:${row.externalId}`);
      console.info(`[admin/shop] policy removed scope=${row.scope} id=${row.externalId}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to remove policy";
      setError(text);
      console.error(`[admin/shop] policy remove failed: ${text}`);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Shop"
        title="Access Policies"
        description="Create/edit Sell products here, then map product/variant IDs to fixed-term entitlement rules."
        breadcrumbs={buildAdminBreadcrumbs("/shop/policies")}
        actions={
          <>
            <Link href="/shop/catalog" className="admin-link">
              Catalog
            </Link>
            <Link href="/shop/customers" className="admin-link">
              Customers
            </Link>
            <Link href="/shop/statistics" className="admin-link">
              Statistics
            </Link>
            <Link href="/mappings" className="admin-link">
              Mappings
            </Link>
          </>
        }
      />

      <AdminSectionCard title="Sell Products (API)">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="admin-label">
            Title
            <input
              value={newProductTitle}
              onChange={(event) => setNewProductTitle(event.target.value)}
              className="admin-input"
              placeholder="Basic plan"
            />
          </label>
          <label className="admin-label md:col-span-2">
            Description
            <input
              value={newProductDescription}
              onChange={(event) => setNewProductDescription(event.target.value)}
              className="admin-input"
              placeholder="Basic plan description"
            />
          </label>
          <label className="admin-label">
            Visibility
            <select
              className="admin-input"
              value={newProductVisibility}
              onChange={(event) => setNewProductVisibility(event.target.value as SellProductVisibility)}
            >
              <option value="PUBLIC">PUBLIC</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="HIDDEN">HIDDEN</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </label>
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => void onCreateProduct()}
              disabled={isCreatingProduct}
              className="admin-btn-primary"
            >
              {isCreatingProduct ? "Creating..." : "Create product"}
            </button>
            <button type="button" onClick={() => void loadSellProducts()} className="admin-btn-secondary">
              Refresh
            </button>
          </div>
        </div>

        {productsMessage ? <p className="mt-3 text-sm text-emerald-400">{productsMessage}</p> : null}
        {productsError ? <p className="mt-3 text-sm text-rose-400">{productsError}</p> : null}
      </AdminSectionCard>

      <AdminTableShell
        title="Sell Product List"
        isLoading={isLoadingProducts}
        isEmpty={!isLoadingProducts && products.length === 0}
        emptyMessage="No Sell products returned for this API key."
        tableClassName="max-h-[28rem] overflow-auto"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2">Policy ID</th>
              <th className="px-3 py-2">Storefront URL</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-3 py-3 align-top">
                  <p className="font-semibold text-slate-100">{product.title}</p>
                  <p className="text-xs text-slate-400">
                    #{product.id} / {product.slug}
                  </p>
                </td>
                <td className="px-3 py-3 align-top text-slate-200">{product.visibility}</td>
                <td className="px-3 py-3 align-top font-mono text-xs text-cyan-300">
                  {policyIdFromProduct(product)}
                </td>
                <td className="px-3 py-3 align-top">
                  {product.url ? (
                    <a href={product.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 underline">
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">n/a</span>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScope("product");
                        setExternalId(policyIdFromProduct(product));
                      }}
                      className="text-xs font-semibold text-cyan-300 underline"
                    >
                      Use in policy
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditProduct(product)}
                      className="text-xs font-semibold text-slate-200 underline"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>

      {editingProductId ? (
        <AdminSectionCard title={`Edit Sell Product #${editingProductId}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="admin-label">
              Title
              <input
                value={editingProductTitle}
                onChange={(event) => setEditingProductTitle(event.target.value)}
                className="admin-input"
              />
            </label>
            <label className="admin-label md:col-span-2">
              Description
              <input
                value={editingProductDescription}
                onChange={(event) => setEditingProductDescription(event.target.value)}
                className="admin-input"
              />
            </label>
            <label className="admin-label">
              Visibility
              <select
                className="admin-input"
                value={editingProductVisibility}
                onChange={(event) => setEditingProductVisibility(event.target.value as SellProductVisibility)}
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="ON_HOLD">ON_HOLD</option>
                <option value="HIDDEN">HIDDEN</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onUpdateProduct()}
              disabled={isUpdatingProduct}
              className="admin-btn-primary"
            >
              {isUpdatingProduct ? "Saving..." : "Save product"}
            </button>
            <button type="button" onClick={cancelEditProduct} className="admin-btn-secondary">
              Cancel
            </button>
          </div>
        </AdminSectionCard>
      ) : null}

      <AdminSectionCard title="Create / update policy">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="admin-label">
            Scope
            <select className="admin-input" value={scope} onChange={(e) => setScope(e.target.value as PolicyScope)}>
              <option value="variant">variant</option>
              <option value="product">product</option>
            </select>
          </label>

          <label className="admin-label">
            External ID
            <input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              className="admin-input"
              placeholder={scope === "variant" ? "sell variant id" : "sell product id or productId|slug"}
            />
          </label>

          <label className="admin-label">
            Tier
            <select className="admin-input" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
              <option value="basic">basic</option>
              <option value="advanced">advanced</option>
              <option value="pro">pro</option>
            </select>
          </label>

          <label className="admin-label">
            Duration days
            <input
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="admin-input"
              placeholder="30"
            />
          </label>

          <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-200">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onSavePolicy()}
            disabled={isSavingPolicy}
            className="admin-btn-primary"
          >
            {isSavingPolicy ? "Saving..." : "Save policy"}
          </button>
          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </div>
        {scope === "product" ? (
          <p className="mt-3 text-xs text-slate-400">
            For auto checkout URLs, use <code>productId|slug</code> (for example <code>349820|basic-plan</code>).
          </p>
        ) : null}
      </AdminSectionCard>

      <AdminTableShell
        title="Configured Policies"
        isLoading={!rows}
        isEmpty={rows !== undefined && rows.length === 0}
        emptyMessage="No policies configured."
        tableClassName="max-h-[22rem] overflow-auto"
      >
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">External ID</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Enabled</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {rows?.map((row) => (
              <tr key={`${row.scope}:${row.externalId}`}>
                <td className="px-3 py-3 text-slate-200">{row.scope}</td>
                <td className="px-3 py-3 font-mono text-xs text-cyan-300">{row.externalId}</td>
                <td className="px-3 py-3 text-slate-200">{row.tier}</td>
                <td className="px-3 py-3 text-slate-300">{row.durationDays ?? "n/a"}</td>
                <td className="px-3 py-3 text-slate-300">{row.enabled ? "yes" : "no"}</td>
                <td className="px-3 py-3 text-xs text-slate-400">
                  {new Date(row.updatedAt).toLocaleString()}
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => void onRemovePolicy(row)}
                    className="text-sm font-semibold text-rose-300 underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
