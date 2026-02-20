"use client";

import { makeFunctionReference } from "convex/server";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import type { CatalogQueryResult, SubscriptionTier } from "../types";
import { buildAutoCheckoutUrl, formatCatalogError, normalizeStorefrontUrl } from "../utils";

type SellProductVisibility = "PUBLIC" | "ON_HOLD" | "HIDDEN" | "PRIVATE";
type SellProductVariantRow = {
  id: number;
  product_id: number;
  title: string;
  description: string | null;
  pricing: {
    type: string | null;
    humble: boolean | null;
    price: { price: number | null; currency: string | null };
  };
  payment_methods: string[];
};

type SellProductRow = {
  id: number;
  uniqid: string | null;
  title: string;
  slug: string;
  description: string | null;
  visibility: SellProductVisibility;
  url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PolicyRow = {
  scope: "product" | "variant";
  externalId: string;
  tier: SubscriptionTier;
  durationDays: number | null;
  enabled: boolean;
  updatedAt: number;
};

type UpsertTierResult =
  | { ok: true; tierId: string }
  | { ok: false; error: { code: string; message: string } };

type UpsertVariantResult =
  | { ok: true; variantId: string }
  | { ok: false; error: { code: string; message: string } };

function policyIdFromProduct(product: SellProductRow): string {
  return `${product.id}|${product.slug}`;
}

function mergeProducts(...groups: SellProductRow[][]): SellProductRow[] {
  const byId = new Map<number, SellProductRow>();
  for (const group of groups) {
    for (const product of group) {
      if (!Number.isInteger(product.id) || product.id <= 0) continue;
      byId.set(product.id, product);
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.id - a.id);
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter((part) => part.trim().length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveProductFromPolicyExternalId(
  externalId: string,
  storefrontUrl: string,
): SellProductRow | null {
  const [idPart, slugPart] = externalId.split("|");
  const parsedId = Number.parseInt((idPart ?? "").trim(), 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) return null;
  const slug = (slugPart ?? "").trim();
  const origin = normalizeStorefrontUrl(storefrontUrl);
  const url = origin && slug ? `${origin}/product/${encodeURIComponent(slug)}` : null;
  return {
    id: parsedId,
    uniqid: null,
    slug,
    title: slug ? titleFromSlug(slug) : `Product ${parsedId}`,
    description: null,
    visibility: "HIDDEN",
    url,
    created_at: null,
    updated_at: null,
  };
}

function defaultTierTitle(tier: SubscriptionTier): string {
  if (tier === "basic") return "Starter";
  if (tier === "advanced") return "Advanced";
  return "Pro";
}

function parseProductIdFromExternalId(externalId: string): number | null {
  const [idPart] = externalId.split("|");
  const parsed = Number.parseInt((idPart ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseProductSlugFromExternalId(externalId: string): string | null {
  const [, slugPart] = externalId.split("|");
  const slug = (slugPart ?? "").trim();
  return slug.length > 0 ? slug : null;
}

function parseDisplayPriceToCents(displayPrice: string): number | null {
  const normalized = displayPrice.trim().replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function CatalogSetupWizard({
  defaultStorefrontUrl,
}: {
  defaultStorefrontUrl: string;
}) {
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
  const listSellPaymentMethodsRef = useMemo(
    () =>
      makeFunctionReference<
        "action",
        { productId?: number; productSlug?: string; productUniqid?: string },
        { items: string[] }
      >("sellProducts:listSellPaymentMethods"),
    [],
  );
  const upsertPolicyRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          scope: "product" | "variant";
          externalId: string;
          tier: SubscriptionTier;
          durationDays?: number;
          enabled: boolean;
        },
        { ok: true }
      >("sellAccessPolicies:upsertSellAccessPolicy"),
    [],
  );
  const upsertSellProductVariantRef = useMemo(
    () =>
      makeFunctionReference<
        "action",
        {
          productId: number;
          productSlug?: string;
          productUniqid?: string;
          title: string;
          description: string;
          priceCents: number;
          currency?: string;
          paymentMethods?: string[];
          minimumPurchaseQuantity?: number;
          maximumPurchaseQuantity?: number;
          manualComment?: string;
        },
        | { ok: true; variant: SellProductVariantRow }
        | { ok: false; error: string }
      >("sellProducts:upsertSellProductVariant"),
    [],
  );
  const listPoliciesRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, PolicyRow[]>(
        "sellAccessPolicies:listSellAccessPolicies",
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
          active?: boolean;
          sortOrder?: number;
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
          tier: SubscriptionTier;
          durationDays: number;
          displayPrice: string;
          priceSuffix?: string;
          checkoutUrl: string;
          highlights?: string[];
          isFeatured?: boolean;
          active?: boolean;
          policyScope: "product" | "variant";
          policyExternalId: string;
        },
        UpsertVariantResult
      >("shopCatalog:upsertShopVariant"),
    [],
  );
  const listCatalogRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, CatalogQueryResult>(
        "shopCatalog:listAdminShopCatalog",
      ),
    [],
  );

  const listSellProducts = useAction(listSellProductsRef);
  const createSellProduct = useAction(createSellProductRef);
  const listSellPaymentMethods = useAction(listSellPaymentMethodsRef);
  const upsertSellProductVariant = useAction(upsertSellProductVariantRef);
  const upsertPolicy = useMutation(upsertPolicyRef);
  const upsertTier = useMutation(upsertTierRef);
  const upsertVariant = useMutation(upsertVariantRef);
  const policies = useQuery(listPoliciesRef, {}) ?? [];
  const catalog = useQuery(listCatalogRef, {});

  const [products, setProducts] = useState<SellProductRow[]>([]);
  const [draftProducts, setDraftProducts] = useState<SellProductRow[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsMessage, setProductsMessage] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);

  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productVisibility, setProductVisibility] = useState<SellProductVisibility>("HIDDEN");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [selectedPolicyExternalId, setSelectedPolicyExternalId] = useState("");

  const [mappingTier, setMappingTier] = useState<SubscriptionTier>("basic");
  const [mappingDurationDays, setMappingDurationDays] = useState("30");
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [mappingMessage, setMappingMessage] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [variantTier, setVariantTier] = useState<SubscriptionTier>("basic");
  const [variantDurationDays, setVariantDurationDays] = useState("30");
  const [variantPrice, setVariantPrice] = useState("$99");
  const [variantPriceSuffix, setVariantPriceSuffix] = useState("");
  const [variantHighlightsText, setVariantHighlightsText] = useState("");
  const [tierTitle, setTierTitle] = useState("Starter");
  const [tierSubtitle, setTierSubtitle] = useState("");
  const [storefrontUrl, setStorefrontUrl] = useState(defaultStorefrontUrl);
  const [variantFeatured, setVariantFeatured] = useState(false);
  const [variantActive, setVariantActive] = useState(true);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [variantMessage, setVariantMessage] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);

  const selectedEnabledPolicy = useMemo(
    () =>
      policies.find(
        (policy) =>
          policy.scope === "product" &&
          policy.externalId === selectedPolicyExternalId &&
          policy.enabled,
      ) ?? null,
    [policies, selectedPolicyExternalId],
  );

  useEffect(() => {
    if (!selectedPolicyExternalId) return;
    const policy = policies.find(
      (row) => row.scope === "product" && row.externalId === selectedPolicyExternalId,
    );
    if (!policy) return;
    setMappingTier(policy.tier);
    if (policy.durationDays !== null) {
      setMappingDurationDays(String(policy.durationDays));
      setVariantDurationDays(String(policy.durationDays));
    }
    setVariantTier(policy.tier);
  }, [policies, selectedPolicyExternalId]);

  const autoCheckoutPreview = useMemo(
    () =>
      buildAutoCheckoutUrl({
        storefrontUrl,
        policyScope: "product",
        policyExternalId: selectedPolicyExternalId,
      }) ?? "",
    [selectedPolicyExternalId, storefrontUrl],
  );

  const tierCount = catalog?.tiers.length ?? 0;
  const variantCount =
    catalog?.tiers.reduce((total, tier) => total + tier.variants.length, 0) ?? 0;

  const policyDerivedProducts = useMemo(
    () =>
      policies
        .filter((policy) => policy.scope === "product")
        .map((policy) => deriveProductFromPolicyExternalId(policy.externalId, storefrontUrl))
        .filter((row): row is SellProductRow => row !== null),
    [policies, storefrontUrl],
  );

  const productOptions = useMemo(
    () => mergeProducts(products, draftProducts, policyDerivedProducts),
    [products, draftProducts, policyDerivedProducts],
  );

  const selectedProduct = useMemo(
    () =>
      productOptions.find(
        (product) => policyIdFromProduct(product) === selectedPolicyExternalId,
      ) ?? null,
    [selectedPolicyExternalId, productOptions],
  );

  const loadSellProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setProductsError(null);
    try {
      const result = await listSellProducts({ page: 1, limit: 100 });
      setProducts(result.items);
      console.info(`[admin/shop-wizard] sell products loaded count=${result.items.length}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to load Sell products";
      setProductsError(text);
      console.error(`[admin/shop-wizard] sell products load failed: ${text}`);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [listSellProducts]);

  useEffect(() => {
    void loadSellProducts();
  }, [loadSellProducts]);

  const loadSellPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true);
    setPaymentMethodsError(null);
    try {
      const result = await listSellPaymentMethods({
        productId: selectedProduct?.id,
        productSlug: selectedProduct?.slug ?? undefined,
        productUniqid: selectedProduct?.uniqid ?? undefined,
      });
      const methods = result.items;
      setAvailablePaymentMethods(methods);
      setSelectedPaymentMethods((current) => {
        const filtered = current.filter((method) => methods.includes(method));
        if (filtered.length > 0) return filtered;
        return methods;
      });
      console.info(`[admin/shop-wizard] payment methods loaded count=${methods.length}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to load payment methods";
      setAvailablePaymentMethods([]);
      setSelectedPaymentMethods([]);
      setPaymentMethodsError(text);
      console.error(`[admin/shop-wizard] payment methods load failed: ${text}`);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, [listSellPaymentMethods, selectedProduct]);

  useEffect(() => {
    void loadSellPaymentMethods();
  }, [loadSellPaymentMethods]);

  async function onCreateProduct() {
    setIsCreatingProduct(true);
    setProductsMessage(null);
    setProductsError(null);
    try {
      const result = await createSellProduct({
        title: productTitle,
        description: productDescription,
        visibility: productVisibility,
      });
      const policyId = policyIdFromProduct(result.product);
      setSelectedPolicyExternalId(policyId);
      setTierTitle(result.product.title || defaultTierTitle(mappingTier));
      setDraftProducts((current) => mergeProducts(current, [result.product]));
      const parsedDuration = Number.parseInt(mappingDurationDays.trim(), 10);
      if (Number.isInteger(parsedDuration) && parsedDuration > 0) {
        await upsertPolicy({
          scope: "product",
          externalId: policyId,
          tier: mappingTier,
          durationDays: parsedDuration,
          enabled: true,
        });
        setVariantTier(mappingTier);
        setVariantDurationDays(String(parsedDuration));
      }
      setProductsMessage(`Created product ${result.product.title} (${policyId}).`);
      setProductTitle("");
      setProductDescription("");
      await loadSellProducts();
      console.info(`[admin/shop-wizard] sell product created id=${policyId}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to create Sell product";
      setProductsError(text);
      console.error(`[admin/shop-wizard] sell product create failed: ${text}`);
    } finally {
      setIsCreatingProduct(false);
    }
  }

  async function onSaveMapping() {
    if (!selectedPolicyExternalId) {
      setMappingError("Select or create a product first.");
      return;
    }
    setIsSavingMapping(true);
    setMappingMessage(null);
    setMappingError(null);
    try {
      const parsedDuration = Number.parseInt(mappingDurationDays.trim(), 10);
      if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
        throw new Error("Duration days must be a positive integer.");
      }
      await upsertPolicy({
        scope: "product",
        externalId: selectedPolicyExternalId,
        tier: mappingTier,
        durationDays: parsedDuration,
        enabled: true,
      });
      setVariantTier(mappingTier);
      setVariantDurationDays(String(parsedDuration));
      if (!tierTitle.trim()) {
        setTierTitle(defaultTierTitle(mappingTier));
      }
      setMappingMessage(`Saved product mapping for ${selectedPolicyExternalId}.`);
      console.info(
        `[admin/shop-wizard] policy mapped external_id=${selectedPolicyExternalId} tier=${mappingTier} duration_days=${parsedDuration}`,
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to save mapping";
      setMappingError(text);
      console.error(`[admin/shop-wizard] policy map failed: ${text}`);
    } finally {
      setIsSavingMapping(false);
    }
  }

  async function onSaveVariant() {
    if (!selectedPolicyExternalId) {
      setVariantError("Select or create a product first.");
      return;
    }
    setIsSavingVariant(true);
    setVariantMessage(null);
    setVariantError(null);
    try {
      const parsedDuration = Number.parseInt(variantDurationDays.trim(), 10);
      if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
        throw new Error("Variant duration days must be a positive integer.");
      }
      const productId = parseProductIdFromExternalId(selectedPolicyExternalId);
      const productSlug = parseProductSlugFromExternalId(selectedPolicyExternalId);
      const productUniqid = selectedProduct?.uniqid ?? null;
      if (!productId) {
        throw new Error("Could not resolve product ID from selected policy key.");
      }
      const priceCents = parseDisplayPriceToCents(variantPrice);
      if (priceCents === null) {
        throw new Error("Display price must contain a valid non-negative number.");
      }
      const checkoutUrl = buildAutoCheckoutUrl({
        storefrontUrl,
        policyScope: "product",
        policyExternalId: selectedPolicyExternalId,
      });
      if (!checkoutUrl) {
        throw new Error(
          "Auto checkout URL could not be generated. Use a valid https storefront URL and a product slug mapping.",
        );
      }

      const tierResult = await upsertTier({
        tier: variantTier,
        title: tierTitle.trim() || defaultTierTitle(variantTier),
        subtitle: tierSubtitle.trim() || undefined,
        active: true,
      });
      if (!tierResult.ok) {
        throw new Error(formatCatalogError(tierResult.error));
      }

      const highlights = variantHighlightsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const sellVariantResult = await upsertSellProductVariant({
        productId,
        productSlug: productSlug ?? undefined,
        productUniqid: productUniqid ?? undefined,
        title: `${parsedDuration}d`,
        description:
          tierSubtitle.trim() || `${variantTier.toUpperCase()} plan for ${parsedDuration} days`,
        priceCents,
        currency: "USD",
        paymentMethods: selectedPaymentMethods.length > 0 ? selectedPaymentMethods : undefined,
        minimumPurchaseQuantity: 1,
        manualComment:
          "Access is delivered automatically after payment confirmation in the dashboard.",
      });
      if (!sellVariantResult.ok) {
        throw new Error(sellVariantResult.error);
      }

      const variantResult = await upsertVariant({
        tier: variantTier,
        durationDays: parsedDuration,
        displayPrice: variantPrice,
        priceSuffix: variantPriceSuffix.trim() || undefined,
        checkoutUrl,
        highlights: highlights.length > 0 ? highlights : undefined,
        isFeatured: variantFeatured,
        active: variantActive,
        policyScope: "product",
        policyExternalId: selectedPolicyExternalId,
      });
      if (!variantResult.ok) {
        throw new Error(formatCatalogError(variantResult.error));
      }

      setVariantMessage(
        `Saved catalog variant ${variantTier}/${parsedDuration}d and Sell checkout variant #${sellVariantResult.variant.id}.`,
      );
      console.info(
        `[admin/shop-wizard] catalog variant saved variant=${variantResult.variantId} sell_variant=${sellVariantResult.variant.id} tier=${variantTier} duration_days=${parsedDuration} policy_id=${selectedPolicyExternalId} price_cents=${priceCents}`,
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to save catalog variant";
      setVariantError(text);
      console.error(`[admin/shop-wizard] catalog variant save failed: ${text}`);
    } finally {
      setIsSavingVariant(false);
    }
  }

  return (
    <AdminSectionCard
      title="Setup Wizard"
      description="Use this guided flow instead of jumping between catalog and policies."
    >
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/55 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Products (Sell API)</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{productOptions.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/55 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Catalog tiers</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{tierCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/55 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Catalog variants</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{variantCount}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="admin-surface-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Step 1</p>
          <h3 className="mt-1 text-base font-semibold text-slate-100">Select or create Sell product</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="admin-label">
              Existing product
              <select
                className="admin-input"
                value={selectedPolicyExternalId}
                onChange={(event) => setSelectedPolicyExternalId(event.target.value)}
              >
                <option value="">Select product...</option>
                {productOptions.map((product) => {
                  const policyId = policyIdFromProduct(product);
                  return (
                    <option key={product.id} value={policyId}>
                      {product.title} ({policyId}) [{product.visibility}]
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="admin-label">
              Visibility
              <select
                className="admin-input"
                value={productVisibility}
                onChange={(event) =>
                  setProductVisibility(event.target.value as SellProductVisibility)
                }
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="ON_HOLD">ON_HOLD</option>
                <option value="HIDDEN">HIDDEN</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>
            </label>
            <label className="admin-label">
              New product title
              <input
                className="admin-input"
                value={productTitle}
                onChange={(event) => setProductTitle(event.target.value)}
                placeholder="Basic plan"
              />
            </label>
            <label className="admin-label">
              New product description
              <input
                className="admin-input"
                value={productDescription}
                onChange={(event) => setProductDescription(event.target.value)}
                placeholder="Basic plan description"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadSellProducts()} className="admin-btn-secondary">
              {isLoadingProducts ? "Refreshing..." : "Refresh products"}
            </button>
            <button
              type="button"
              onClick={() => void onCreateProduct()}
              disabled={isCreatingProduct}
              className="admin-btn-primary"
            >
              {isCreatingProduct ? "Creating..." : "Create product"}
            </button>
          </div>
          {selectedProduct ? (
          <p className="mt-3 text-xs text-slate-300">
            Selected: {selectedProduct.title} ({selectedPolicyExternalId})
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">
          Note: Sell list API only returns public/live products. Draft/hidden products are kept here
          when created or already linked by policy.
        </p>
        {productsMessage ? <p className="mt-2 text-sm text-emerald-400">{productsMessage}</p> : null}
        {productsError ? <p className="mt-2 text-sm text-rose-400">{productsError}</p> : null}
      </div>

        <div className="admin-surface-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Step 2</p>
          <h3 className="mt-1 text-base font-semibold text-slate-100">Access mapping (policy)</h3>
          <p className="mt-1 text-xs text-slate-400">
            Product policy key is auto-linked from your selected Sell product.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="admin-label md:col-span-2">
              Linked product policy key
              <div className="admin-input flex items-center font-mono text-xs text-cyan-300">
                {selectedPolicyExternalId || "Select a product in Step 1"}
              </div>
            </div>
            <label className="admin-label">
              Tier
              <select
                className="admin-input"
                value={mappingTier}
                onChange={(event) => setMappingTier(event.target.value as SubscriptionTier)}
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
                value={mappingDurationDays}
                onChange={(event) => setMappingDurationDays(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onSaveMapping()}
              disabled={isSavingMapping}
              className="admin-btn-primary"
            >
              {isSavingMapping ? "Saving..." : "Save access mapping"}
            </button>
          </div>
          {selectedEnabledPolicy ? (
            <p className="mt-2 text-xs text-emerald-300">
              Active mapping found: {selectedEnabledPolicy.tier} /{" "}
              {selectedEnabledPolicy.durationDays ?? "n/a"}d.
            </p>
          ) : null}
          {mappingMessage ? <p className="mt-2 text-sm text-emerald-400">{mappingMessage}</p> : null}
          {mappingError ? <p className="mt-2 text-sm text-rose-400">{mappingError}</p> : null}
        </div>

        <div className="admin-surface-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Step 3</p>
          <h3 className="mt-1 text-base font-semibold text-slate-100">Catalog variant + pricing</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="admin-label">
              Tier
              <select
                className="admin-input"
                value={variantTier}
                onChange={(event) => setVariantTier(event.target.value as SubscriptionTier)}
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
                value={variantDurationDays}
                onChange={(event) => setVariantDurationDays(event.target.value)}
              />
            </label>
            <label className="admin-label">
              Tier card title
              <input
                className="admin-input"
                value={tierTitle}
                onChange={(event) => setTierTitle(event.target.value)}
              />
            </label>
            <label className="admin-label">
              Tier subtitle (optional)
              <input
                className="admin-input"
                value={tierSubtitle}
                onChange={(event) => setTierSubtitle(event.target.value)}
              />
            </label>
            <label className="admin-label">
              Display price
              <input
                className="admin-input"
                value={variantPrice}
                onChange={(event) => setVariantPrice(event.target.value)}
                placeholder="$99"
              />
            </label>
            <label className="admin-label">
              Price suffix
              <input
                className="admin-input"
                value={variantPriceSuffix}
                onChange={(event) => setVariantPriceSuffix(event.target.value)}
                placeholder="/month"
              />
            </label>
            <label className="admin-label md:col-span-2">
              Highlights (one per line)
              <textarea
                className="admin-textarea"
                value={variantHighlightsText}
                onChange={(event) => setVariantHighlightsText(event.target.value)}
              />
            </label>
            <label className="admin-label md:col-span-2">
              Sell storefront URL
              <input
                className="admin-input"
                value={storefrontUrl}
                onChange={(event) => setStorefrontUrl(event.target.value)}
                placeholder="https://g3netic.sell.app"
              />
            </label>
            <div className="admin-label md:col-span-2">
              Payment methods
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/55 p-3">
                <div className="flex flex-wrap gap-2">
                  {availablePaymentMethods.map((method) => {
                    const checked = selectedPaymentMethods.includes(method);
                    return (
                      <label
                        key={method}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextChecked = event.target.checked;
                            setSelectedPaymentMethods((current) => {
                              if (nextChecked) {
                                return Array.from(new Set([...current, method]));
                              }
                              return current.filter((value) => value !== method);
                            });
                          }}
                        />
                        {method}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadSellPaymentMethods()}
                    className="admin-btn-secondary"
                  >
                    {isLoadingPaymentMethods ? "Refreshing..." : "Refresh payment methods"}
                  </button>
                </div>
                {availablePaymentMethods.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    No payment methods discovered from Sell product variants yet. Saving without an
                    explicit list lets Sell apply store defaults. To force defaults from terminal:
                    <span className="ml-1 font-mono text-cyan-300">
                      npx convex env set SELLAPP_DEFAULT_PAYMENT_METHODS STRIPE,PAYPAL
                    </span>
                  </p>
                ) : null}
                {paymentMethodsError ? (
                  <p className="mt-2 text-xs text-rose-400">{paymentMethodsError}</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                checked={variantFeatured}
                onChange={(event) => setVariantFeatured(event.target.checked)}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                checked={variantActive}
                onChange={(event) => setVariantActive(event.target.checked)}
              />
              Active
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Auto checkout preview: {autoCheckoutPreview || "unavailable"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onSaveVariant()}
              disabled={isSavingVariant}
              className="admin-btn-primary"
            >
              {isSavingVariant ? "Saving..." : "Save catalog variant"}
            </button>
          </div>
          {variantMessage ? <p className="mt-2 text-sm text-emerald-400">{variantMessage}</p> : null}
          {variantError ? <p className="mt-2 text-sm text-rose-400">{variantError}</p> : null}
        </div>
      </div>
    </AdminSectionCard>
  );
}
