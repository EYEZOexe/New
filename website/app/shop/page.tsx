"use client";

import { ShopHero } from "./components/ShopHero";
import { ShopTierCard } from "./components/ShopTierCard";
import { useShopCatalog } from "./useShopCatalog";
import { PageFrame } from "@/components/site/page-frame";

export default function ShopPage() {
  const shop = useShopCatalog();

  return (
    <PageFrame>
        <ShopHero
          viewer={shop.viewer}
          tierCount={shop.catalog?.tiers.length ?? 0}
          totalVariants={shop.totalVariants}
        />

        {!shop.catalog ? (
          <div className="site-panel">
            <p className="text-sm text-muted-foreground">Loading plans...</p>
          </div>
        ) : shop.catalog.tiers.length === 0 ? (
          <div className="site-panel">
            <p className="text-sm text-muted-foreground">
              Plans are not published yet. Please check back shortly.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {shop.catalog.tiers.map((tier) => (
              <ShopTierCard
                key={tier.tier}
                tier={tier}
                selectedVariant={shop.resolveSelectedVariant(tier)}
                onSelectDuration={(durationDays) => shop.onSelectDuration(tier.tier, durationDays)}
              />
            ))}
          </div>
        )}
    </PageFrame>
  );
}
