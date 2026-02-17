"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CatalogQueryResult,
  FlattenedCatalogVariant,
  PolicyRow,
  PolicyScope,
  RemoveVariantResult,
  SetVariantActiveResult,
  SubscriptionTier,
  UpsertTierResult,
  UpsertVariantResult,
} from "./types";
import {
  buildAutoCheckoutUrl,
  formatCatalogError,
  parsePolicyOptionValue,
} from "./utils";

const STOREFRONT_STORAGE_KEY = "admin.catalog.sellStorefront";

const listAdminRef = makeFunctionReference<
  "query",
  Record<string, never>,
  CatalogQueryResult
>("shopCatalog:listAdminShopCatalog");

const listPoliciesRef = makeFunctionReference<
  "query",
  Record<string, never>,
  PolicyRow[]
>("sellAccessPolicies:listSellAccessPolicies");

const upsertTierRef = makeFunctionReference<
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
>("shopCatalog:upsertShopTier");

const upsertVariantRef = makeFunctionReference<
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
>("shopCatalog:upsertShopVariant");

const removeVariantRef = makeFunctionReference<
  "mutation",
  { variantId: string },
  RemoveVariantResult
>("shopCatalog:removeShopVariant");

const setVariantActiveRef = makeFunctionReference<
  "mutation",
  { variantId: string; active: boolean },
  SetVariantActiveResult
>("shopCatalog:setShopVariantActive");

export function useCatalogEditor(defaultStorefrontUrl: string) {
  const catalog = useQuery(listAdminRef, {});
  const policies = useQuery(listPoliciesRef, {});
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
  const [highlightsText, setHighlightsText] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [variantSortOrder, setVariantSortOrder] = useState("");
  const [variantActive, setVariantActive] = useState(true);
  const [policyScope, setPolicyScope] = useState<PolicyScope>("product");
  const [policyExternalId, setPolicyExternalId] = useState("");
  const [storefrontUrl, setStorefrontUrl] = useState(defaultStorefrontUrl);
  const [useCustomCheckoutUrl, setUseCustomCheckoutUrl] = useState(false);
  const [customCheckoutUrl, setCustomCheckoutUrl] = useState("https://");
  const [isSavingVariant, setIsSavingVariant] = useState(false);

  const flattenedVariants = useMemo<FlattenedCatalogVariant[]>(
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

  const enabledPolicies = useMemo(
    () => (policies ?? []).filter((policy) => policy.enabled),
    [policies],
  );

  const scopePolicies = useMemo(
    () => enabledPolicies.filter((policy) => policy.scope === policyScope),
    [enabledPolicies, policyScope],
  );

  const selectedPolicy = useMemo(
    () =>
      enabledPolicies.find(
        (policy) =>
          policy.scope === policyScope && policy.externalId === policyExternalId,
      ) ?? null,
    [enabledPolicies, policyScope, policyExternalId],
  );

  const autoCheckoutUrl = useMemo(
    () =>
      buildAutoCheckoutUrl({
        storefrontUrl,
        policyScope,
        policyExternalId,
      }),
    [policyExternalId, policyScope, storefrontUrl],
  );

  const checkoutPreview = useMemo(() => {
    if (useCustomCheckoutUrl) return customCheckoutUrl.trim();
    return autoCheckoutUrl ?? "";
  }, [autoCheckoutUrl, customCheckoutUrl, useCustomCheckoutUrl]);

  const activeVariantCount = useMemo(
    () => flattenedVariants.filter((variant) => variant.active).length,
    [flattenedVariants],
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
    if (typeof window === "undefined" || defaultStorefrontUrl) return;
    const stored = window.localStorage.getItem(STOREFRONT_STORAGE_KEY);
    if (stored) {
      setStorefrontUrl(stored);
    }
  }, [defaultStorefrontUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const normalized = storefrontUrl.trim();
    if (!normalized) return;
    window.localStorage.setItem(STOREFRONT_STORAGE_KEY, normalized);
  }, [storefrontUrl]);

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
    setHighlightsText(selectedVariant.highlights.join("\n"));
    setIsFeatured(selectedVariant.isFeatured);
    setVariantSortOrder(
      selectedVariant.sortOrder === null ? "" : String(selectedVariant.sortOrder),
    );
    setVariantActive(selectedVariant.active);
    setPolicyScope(selectedVariant.policyScope);
    setPolicyExternalId(selectedVariant.policyExternalId);

    const generated = buildAutoCheckoutUrl({
      storefrontUrl,
      policyScope: selectedVariant.policyScope,
      policyExternalId: selectedVariant.policyExternalId,
    });

    if (generated && generated === selectedVariant.checkoutUrl) {
      setUseCustomCheckoutUrl(false);
      setCustomCheckoutUrl("https://");
    } else {
      setUseCustomCheckoutUrl(true);
      setCustomCheckoutUrl(selectedVariant.checkoutUrl);
    }
  }, [selectedVariant, storefrontUrl]);

  useEffect(() => {
    if (!enabledPolicies.length || policyExternalId) return;
    const defaultPolicy = enabledPolicies.find((policy) => policy.scope === "product");
    if (!defaultPolicy) return;
    setPolicyScope(defaultPolicy.scope);
    setPolicyExternalId(defaultPolicy.externalId);
    setVariantTier(defaultPolicy.tier);
    if (defaultPolicy.durationDays) {
      setDurationDays(String(defaultPolicy.durationDays));
    }
  }, [enabledPolicies, policyExternalId]);

  const onSelectPolicy = useCallback(
    (value: string) => {
      const parsed = parsePolicyOptionValue(value);
      if (!parsed) return;
      setPolicyScope(parsed.scope);
      setPolicyExternalId(parsed.externalId);
      const policy = enabledPolicies.find(
        (row) => row.scope === parsed.scope && row.externalId === parsed.externalId,
      );
      if (!policy) return;
      setVariantTier(policy.tier);
      if (policy.durationDays !== null) {
        setDurationDays(String(policy.durationDays));
      }
      console.info(
        `[admin/catalog] selected policy scope=${policy.scope} id=${policy.externalId} tier=${policy.tier} duration_days=${policy.durationDays ?? "none"}`,
      );
    },
    [enabledPolicies],
  );

  const onSaveTier = useCallback(async () => {
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
        setError(formatCatalogError(result.error));
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
  }, [
    tierSortOrder,
    tier,
    tierTitle,
    tierSubtitle,
    tierBadge,
    tierDescription,
    tierActive,
    upsertTier,
  ]);

  const onSaveVariant = useCallback(async () => {
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

      const checkoutUrlToSave = useCustomCheckoutUrl
        ? customCheckoutUrl.trim()
        : autoCheckoutUrl;
      if (!checkoutUrlToSave) {
        if (policyScope === "variant") {
          throw new Error(
            "Variant policy selected without custom checkout URL. Use a product policy or enable custom checkout URL override.",
          );
        }
        throw new Error(
          "Checkout URL could not be generated. Set a valid https storefront URL or enable custom checkout URL override.",
        );
      }

      const result = await upsertVariant({
        variantId: selectedVariantId || undefined,
        tier: variantTier,
        durationDays: parsedDuration,
        displayPrice,
        priceSuffix: priceSuffix || undefined,
        checkoutUrl: checkoutUrlToSave,
        highlights: highlights.length > 0 ? highlights : undefined,
        isFeatured,
        sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined,
        active: variantActive,
        policyScope,
        policyExternalId,
      });
      if (!result.ok) {
        setError(formatCatalogError(result.error));
        return;
      }

      setMessage(
        selectedVariantId
          ? `Variant ${selectedVariantId} updated.`
          : `Variant ${result.variantId} created.`,
      );
      console.info(
        `[admin/catalog] variant saved variant=${result.variantId} tier=${variantTier} duration_days=${parsedDuration} active=${variantActive} policy_scope=${policyScope} policy_id=${policyExternalId} checkout_source=${useCustomCheckoutUrl ? "custom" : "policy_product"} checkout_url=${checkoutUrlToSave}`,
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
  }, [
    durationDays,
    variantSortOrder,
    highlightsText,
    useCustomCheckoutUrl,
    customCheckoutUrl,
    autoCheckoutUrl,
    policyScope,
    upsertVariant,
    selectedVariantId,
    variantTier,
    displayPrice,
    priceSuffix,
    isFeatured,
    variantActive,
    policyExternalId,
  ]);

  const onToggleVariantActive = useCallback(
    async (variantId: string, active: boolean) => {
      setMessage(null);
      setError(null);
      try {
        const result = await setVariantActiveMutation({ variantId, active });
        if (!result.ok) {
          setError(formatCatalogError(result.error));
          return;
        }
        setMessage(`Variant ${variantId} is now ${active ? "active" : "inactive"}.`);
        console.info(
          `[admin/catalog] variant active toggle variant=${variantId} active=${active}`,
        );
      } catch (err) {
        const text = err instanceof Error ? err.message : "Failed to update variant status";
        setError(text);
        console.error(`[admin/catalog] variant toggle failed: ${text}`);
      }
    },
    [setVariantActiveMutation],
  );

  const onRemoveVariant = useCallback(
    async (variantId: string) => {
      setMessage(null);
      setError(null);
      try {
        const result = await removeVariant({ variantId });
        if (!result.ok) {
          setError(formatCatalogError(result.error));
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
    },
    [removeVariant, selectedVariantId],
  );

  return {
    catalog,
    flattenedVariants,
    activeVariantCount,
    message,
    error,
    tier,
    setTier,
    tierTitle,
    setTierTitle,
    tierSubtitle,
    setTierSubtitle,
    tierBadge,
    setTierBadge,
    tierDescription,
    setTierDescription,
    tierSortOrder,
    setTierSortOrder,
    tierActive,
    setTierActive,
    isSavingTier,
    onSaveTier,
    selectedVariantId,
    setSelectedVariantId,
    variantTier,
    setVariantTier,
    durationDays,
    setDurationDays,
    displayPrice,
    setDisplayPrice,
    priceSuffix,
    setPriceSuffix,
    highlightsText,
    setHighlightsText,
    isFeatured,
    setIsFeatured,
    variantSortOrder,
    setVariantSortOrder,
    variantActive,
    setVariantActive,
    policyScope,
    setPolicyScope,
    policyExternalId,
    setPolicyExternalId,
    scopePolicies,
    selectedPolicy,
    storefrontUrl,
    setStorefrontUrl,
    useCustomCheckoutUrl,
    setUseCustomCheckoutUrl,
    customCheckoutUrl,
    setCustomCheckoutUrl,
    checkoutPreview,
    isSavingVariant,
    onSelectPolicy,
    onSaveVariant,
    onToggleVariantActive,
    onRemoveVariant,
  };
}
