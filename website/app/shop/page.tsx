"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SubscriptionTier = "basic" | "advanced" | "pro";

type CatalogVariant = {
  _id: string;
  tier: SubscriptionTier;
  durationDays: number;
  displayPrice: string;
  priceSuffix: string | null;
  checkoutUrl: string;
  highlights: string[];
  isFeatured: boolean;
  active: boolean;
};

type CatalogTier = {
  tier: SubscriptionTier;
  title: string;
  subtitle: string | null;
  badge: string | null;
  description: string | null;
  variants: CatalogVariant[];
};

type CatalogQueryResult = {
  tiers: CatalogTier[];
};

type ViewerRow = {
  userId: string;
  tier: SubscriptionTier | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  hasSignalAccess: boolean;
};

function buildCheckoutUrl(baseUrl: string, tier: SubscriptionTier, durationDays: number): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("source", "website_shop");
    url.searchParams.set("tier", tier);
    url.searchParams.set("duration_days", String(durationDays));
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export default function ShopPage() {
  const listCatalogRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, CatalogQueryResult>(
        "shopCatalog:listPublicShopCatalog",
      ),
    [],
  );
  const viewerRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, ViewerRow | null>("users:viewer"),
    [],
  );

  const catalog = useQuery(listCatalogRef, {});
  const viewer = useQuery(viewerRef, {});

  const [selectedDurationByTier, setSelectedDurationByTier] = useState<
    Partial<Record<SubscriptionTier, number>>
  >({});

  useEffect(() => {
    if (!catalog?.tiers) return;
    setSelectedDurationByTier((current) => {
      const next = { ...current };
      for (const tier of catalog.tiers) {
        if (!next[tier.tier] && tier.variants.length > 0) {
          next[tier.tier] = tier.variants[0].durationDays;
        }
      }
      return next;
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

  return (
    <main className="site-shell">
      <section className="site-wrap">
        <div className="site-surface">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="site-chip">Shop</p>
              <h1 className="site-title mt-4">Choose your tier, then duration.</h1>
              <p className="site-subtitle">
                Tier-first plan selection with Sell checkout links managed from the realtime admin
                catalog.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="site-link">
                Home
              </Link>
              <Link href="/dashboard" className="site-link">
                Dashboard
              </Link>
            </div>
          </div>

          {viewer ? (
            <p className="mt-4 text-sm text-slate-600">
              Current access: {viewer.subscriptionStatus ?? "inactive"} / tier {viewer.tier ?? "none"}
            </p>
          ) : null}
        </div>

        {!catalog ? (
          <div className="site-surface">
            <p className="text-sm text-slate-600">Loading plans...</p>
          </div>
        ) : catalog.tiers.length === 0 ? (
          <div className="site-surface">
            <p className="text-sm text-slate-600">
              Plans are not published yet. Please check back shortly.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {catalog.tiers.map((tier) => {
              const selectedDuration =
                selectedDurationByTier[tier.tier] ?? tier.variants[0]?.durationDays;
              const selectedVariant = tier.variants.find(
                (variant) => variant.durationDays === selectedDuration,
              );
              return (
                <article key={tier.tier} className="site-surface">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-semibold text-slate-900">{tier.title}</p>
                    {tier.badge ? (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                        {tier.badge}
                      </span>
                    ) : null}
                  </div>
                  {tier.subtitle ? (
                    <p className="mt-2 text-sm font-medium text-slate-700">{tier.subtitle}</p>
                  ) : null}
                  {tier.description ? (
                    <p className="mt-2 text-sm text-slate-600">{tier.description}</p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {tier.variants.map((variant) => (
                      <button
                        key={variant._id}
                        type="button"
                        className={
                          variant.durationDays === selectedDuration
                            ? "site-btn-primary h-9 px-3"
                            : "site-btn-secondary h-9 px-3"
                        }
                        onClick={() =>
                          setSelectedDurationByTier((current) => ({
                            ...current,
                            [tier.tier]: variant.durationDays,
                          }))
                        }
                      >
                        {variant.durationDays}d
                      </button>
                    ))}
                  </div>

                  {selectedVariant ? (
                    <div className="mt-6 space-y-3">
                      <p className="text-3xl font-semibold text-slate-900">
                        {selectedVariant.displayPrice}
                        {selectedVariant.priceSuffix ? (
                          <span className="ml-1 text-base font-medium text-slate-500">
                            {selectedVariant.priceSuffix}
                          </span>
                        ) : null}
                      </p>

                      {selectedVariant.highlights.length > 0 ? (
                        <ul className="space-y-1 text-sm text-slate-700">
                          {selectedVariant.highlights.map((highlight, index) => (
                            <li key={`${selectedVariant._id}-${index}`}>• {highlight}</li>
                          ))}
                        </ul>
                      ) : null}

                      <a
                        href={buildCheckoutUrl(
                          selectedVariant.checkoutUrl,
                          tier.tier,
                          selectedVariant.durationDays,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="site-btn-primary w-full"
                      >
                        Checkout {tier.title}
                      </a>
                      <p className="text-xs text-slate-500">
                        After payment, return here and open{" "}
                        <Link href="/checkout/return" className="underline">
                          checkout status
                        </Link>{" "}
                        for realtime entitlement confirmation.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-6 text-sm text-slate-500">
                      No active duration variants are currently available.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
