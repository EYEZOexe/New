import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { ViewerRow } from "../types";

type ShopHeroProps = {
  viewer: ViewerRow | null | undefined;
  tierCount: number;
  totalVariants: number;
};

export function ShopHero(props: ShopHeroProps) {
  const subscriptionStatus = props.viewer?.subscriptionStatus ?? "inactive";
  const tier = props.viewer?.tier ?? "none";

  return (
    <Card className="site-panel relative overflow-hidden">
      <CardContent className="space-y-5 px-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-4xl">
            <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-100">
              Shop
            </Badge>
            <h1 className="site-title mt-4">Choose a tier. Select a duration. Launch checkout.</h1>
            <p className="site-subtitle">
              Plans are policy-linked from admin and entitlement sync is handled in realtime. This
              keeps purchase, activation, and dashboard visibility in one consistent flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Current access:</span>
          <Badge variant="outline" className="capitalize">
            {subscriptionStatus}
          </Badge>
          <Badge variant="outline" className="uppercase">
            {tier}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="site-stat">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Published tiers</p>
            <p className="mt-1 text-2xl font-semibold">{props.tierCount}</p>
          </div>
          <div className="site-stat">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Checkout variants</p>
            <p className="mt-1 text-2xl font-semibold">{props.totalVariants}</p>
          </div>
          <div className="site-stat">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Realtime sync</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">Live</p>
          </div>
          <div className="site-stat">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Route model</p>
            <p className="mt-1 text-2xl font-semibold">Separate pages</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
