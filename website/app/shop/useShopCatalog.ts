"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CatalogQueryResult, CatalogTier, SubscriptionTier, ViewerRow } from "./types";

const listCatalogRef = makeFunctionReference<
  "query",
  Record<string, never>,
  CatalogQueryResult
>("shopCatalog:listPublicShopCatalog");

const viewerRef = makeFunctionReference<
  "query",
  Record<string, never>,
  ViewerRow | null
>("users:viewer");

export function useShopCatalog() {
  const catalog = useQuery(listCatalogRef, {});
  const viewer = useQuery(viewerRef, {});

  const [selectedDurationByTier, setSelectedDurationByTier] = useState<
    Partial<Record<SubscriptionTier, number>>
  >({});

  const totalVariants = useMemo(
    () => (catalog?.tiers ?? []).reduce((total, tier) => total + tier.variants.length, 0),
    [catalog],
  );

  useEffect(() => {
    if (!catalog?.tiers) return;
    setSelectedDurationByTier((current) => {
      let changed = false;
      const next = { ...current };
      for (const tier of catalog.tiers) {
        if (!next[tier.tier] && tier.variants.length > 0) {
          next[tier.tier] = tier.variants[0].durationDays;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [catalog]);

  useEffect(() => {
    if (!catalog?.tiers) return;
    const variantCount = catalog.tiers.reduce(
      (total, tier) => total + tier.variants.length,
      0,
    );
    console.info(
      `[shop] catalog update tiers=${catalog.tiers.length} variants=${variantCount}`,
    );
  }, [catalog]);

  const onSelectDuration = useCallback(
    (tier: SubscriptionTier, durationDays: number) => {
      setSelectedDurationByTier((current) => ({
        ...current,
        [tier]: durationDays,
      }));
    },
    [],
  );

  const resolveSelectedVariant = useCallback(
    (tier: CatalogTier) => {
      const selectedDuration =
        selectedDurationByTier[tier.tier] ?? tier.variants[0]?.durationDays;
      return tier.variants.find((variant) => variant.durationDays === selectedDuration) ?? null;
    },
    [selectedDurationByTier],
  );

  return {
    catalog,
    viewer,
    totalVariants,
    selectedDurationByTier,
    onSelectDuration,
    resolveSelectedVariant,
  };
}
