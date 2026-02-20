import { BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { ViewerRow } from "../types";

type ShopHeroProps = {
  viewer: ViewerRow | null | undefined;
  tierCount: number;
  totalVariants: number;
};

function normalizeStatus(status: ViewerRow["subscriptionStatus"]): string {
  if (status === "past_due") return "Action needed";
  if (status === "inactive") return "Inactive";
  if (!status) return "No active plan";
  return status;
}

export function ShopHero(props: ShopHeroProps) {
  return (
    <section className="site-panel site-animate-in space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
        <div className="space-y-4">
          <Badge variant="secondary" className="w-fit rounded-full bg-cyan-500/20 text-cyan-100">
            Pricing
          </Badge>
          <h1 className="site-title text-4xl md:text-6xl">Simple pricing. Clear access. No clutter.</h1>
          <p className="site-subtitle max-w-3xl">
            Pick your plan, select duration, and launch checkout in one clean flow.
            Upgrade anytime as your trading needs evolve.
          </p>
        </div>

        <Card className="site-card-hover rounded-2xl border border-border/70 bg-background/45 p-4">
          <CardContent className="space-y-4 px-0">
            <p className="site-kicker">Your account summary</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Current tier</span>
                <Badge variant="outline" className="rounded-full uppercase">
                  {props.viewer?.tier ?? "None"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Subscription status</span>
                <span className="font-medium">{normalizeStatus(props.viewer?.subscriptionStatus ?? null)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Signal access</span>
                <span className="font-medium">{props.viewer?.hasSignalAccess ? "Active" : "Locked"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="site-stat site-card-hover">
          <p className="site-kicker">Plans available</p>
          <p className="mt-2 text-2xl font-semibold">{props.tierCount}</p>
        </div>
        <div className="site-stat site-card-hover">
          <p className="site-kicker">Billing options</p>
          <p className="mt-2 text-2xl font-semibold">{props.totalVariants}</p>
        </div>
        <div className="site-stat site-card-hover">
          <p className="site-kicker">Checkout experience</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">Fast</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="site-card-hover rounded-2xl border border-border/70 bg-background/45 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <BadgeCheck className="size-4 text-cyan-300" />
            Instant plan activation
          </p>
        </div>
        <div className="site-card-hover rounded-2xl border border-border/70 bg-background/45 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4 text-cyan-300" />
            Secure account controls
          </p>
        </div>
        <div className="site-card-hover rounded-2xl border border-border/70 bg-background/45 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 text-cyan-300" />
            Built for active traders
          </p>
        </div>
      </div>
    </section>
  );
}
