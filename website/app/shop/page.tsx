"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { CheckCircle2, Headset, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { MarketingFrame } from "@/components/site/marketing-frame";
import { MarketingNav } from "@/components/site/marketing-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
        <section className="site-animate-in site-animate-in-delay-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="site-kicker">Plans</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">Choose your tier</h2>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              Select duration inside each plan
            </Badge>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {shop.catalog.tiers.map((tier) => (
              <ShopTierCard
                key={tier.tier}
                tier={tier}
                selectedVariant={shop.resolveSelectedVariant(tier)}
                onSelectDuration={(durationDays) => shop.onSelectDuration(tier.tier, durationDays)}
                viewerEmail={shop.viewer?.email ?? null}
              />
            ))}
          </div>
        </section>
      )}

      <section className="site-animate-in site-animate-in-delay-2 grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="site-card-hover rounded-3xl border border-border/70 bg-card/80 p-6">
          <CardContent className="space-y-4 px-0">
            <p className="site-kicker">All plans include</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { title: "Signal workspace", icon: CheckCircle2 },
                { title: "Trade journal tracking", icon: CheckCircle2 },
                { title: "Structured market modules", icon: ShieldCheck },
                { title: "Account-level access control", icon: ShieldCheck },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/70 bg-background/45 p-4 text-sm font-medium">
                  <p className="flex items-center gap-2">
                    <item.icon className="size-4 text-cyan-300" />
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="site-card-hover rounded-3xl border border-border/70 bg-card/80 p-6">
          <CardContent className="space-y-4 px-0">
            <p className="site-kicker">Need help choosing?</p>
            <h3 className="text-2xl font-semibold tracking-tight">We can help you pick the right tier.</h3>
            <p className="text-sm text-muted-foreground">
              If you are unsure where to start, begin with the plan that matches your current trade frequency.
              You can always move up later.
            </p>
            <Button asChild className="w-full rounded-xl">
              <Link href="/login">
                <Headset className="size-4" />
                Open account
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </MarketingFrame>
  );
}
