"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";

import { MarketingFrame } from "@/components/site/marketing-frame";
import { MarketingNav } from "@/components/site/marketing-nav";
import { Button } from "@/components/ui/button";

import { ShopHero } from "./components/ShopHero";
import { ShopTierCard } from "./components/ShopTierCard";
import { useShopCatalog } from "./useShopCatalog";

export default function ShopPage() {
  const shop = useShopCatalog();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  return (
    <MarketingFrame>
      <MarketingNav
        rightSlot={
          isAuthenticated ? (
            <Button size="sm" onClick={() => void signOut()} className="rounded-full px-4">
              Log out
            </Button>
          ) : (
            <Button asChild size="sm" className="rounded-full px-4">
              <Link href="/signup">Create account</Link>
            </Button>
          )
        }
      />

      <ShopHero
        viewer={shop.viewer}
        tierCount={shop.catalog?.tiers.length ?? 0}
        totalVariants={shop.totalVariants}
      />

      {!shop.catalog ? (
        <div className="rounded-2xl border border-border/70 bg-card/85 p-6 text-sm text-muted-foreground">
          Loading plans...
        </div>
      ) : shop.catalog.tiers.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/85 p-6 text-sm text-muted-foreground">
          Plans are being prepared. Please check back shortly.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
    </MarketingFrame>
  );
}
