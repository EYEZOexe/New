import { ShieldCheck, Sparkles, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { ViewerRow } from "../types";

type ShopHeroProps = {
  viewer: ViewerRow | null | undefined;
  tierCount: number;
  totalVariants: number;
};

export function ShopHero(props: ShopHeroProps) {
  return (
    <Card className="rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-8">
      <CardContent className="space-y-6 px-0">
        <div className="space-y-4">
          <Badge variant="secondary" className="rounded-full bg-cyan-500/20 text-cyan-100">
            Pricing
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Choose the plan that fits your trading pace.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            Transparent pricing, clean access, and immediate onboarding. Start with the plan that fits your
            current workflow and upgrade when you need more depth.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Your current tier</p>
            <p className="mt-2 text-2xl font-semibold uppercase">{props.viewer?.tier ?? "None"}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Available plans</p>
            <p className="mt-2 text-2xl font-semibold">{props.tierCount}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Billing options</p>
            <p className="mt-2 text-2xl font-semibold">{props.totalVariants}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Support</p>
            <p className="mt-2 text-2xl font-semibold">Priority</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <WalletCards className="size-4 text-cyan-300" />
              Simple checkout
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-cyan-300" />
              Secure account access
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-cyan-300" />
              Fast onboarding
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
