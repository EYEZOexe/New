import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { CatalogTier, CatalogVariant } from "../types";
import { buildCheckoutUrl } from "../utils";

type ShopTierCardProps = {
  tier: CatalogTier;
  selectedVariant: CatalogVariant | null;
  onSelectDuration: (durationDays: number) => void;
};

function getTierAccentClass(tier: CatalogTier["tier"]) {
  if (tier === "basic") return "from-cyan-400/35 to-transparent";
  if (tier === "advanced") return "from-amber-400/35 to-transparent";
  return "from-fuchsia-400/35 to-transparent";
}

export function ShopTierCard(props: ShopTierCardProps) {
  const selected = props.selectedVariant;
  const tierIsFeatured = props.tier.variants.some((variant) => variant.isFeatured);

  return (
    <Card className="site-card-hover relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card/85">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getTierAccentClass(props.tier.tier)}`} />
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{props.tier.title}</h2>
              {props.tier.subtitle ? <p className="mt-1 text-sm text-muted-foreground">{props.tier.subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {tierIsFeatured ? (
                <Badge className="rounded-full bg-cyan-500/20 text-cyan-100">
                  <Sparkles className="mr-1 size-3.5" />
                  Popular
                </Badge>
              ) : null}
              {props.tier.badge ? (
                <Badge variant="outline" className="rounded-full">
                  {props.tier.badge}
                </Badge>
              ) : null}
            </div>
          </div>
          {props.tier.description ? <p className="text-sm text-muted-foreground">{props.tier.description}</p> : null}
        </div>

        <div className="space-y-2.5">
          <p className="site-kicker">Duration</p>
          <div className="flex flex-wrap gap-2">
            {props.tier.variants.map((variant) => (
              <Button
                key={variant._id}
                size="sm"
                type="button"
                variant={selected?.durationDays === variant.durationDays ? "default" : "outline"}
                className="rounded-full px-4"
                onClick={() => props.onSelectDuration(variant.durationDays)}
              >
                {variant.durationDays} days
              </Button>
            ))}
          </div>
        </div>

        {selected ? (
          <>
            <div className="rounded-2xl border border-border/70 bg-background/45 px-4 py-3.5">
              <p className="site-kicker">Price</p>
              <p className="mt-2 text-4xl font-semibold leading-none">
                {selected.displayPrice}
                {selected.priceSuffix ? (
                  <span className="ml-1 text-base font-medium text-muted-foreground">{selected.priceSuffix}</span>
                ) : null}
              </p>
            </div>

            {selected.highlights.length > 0 ? (
              <ul className="space-y-2 text-sm text-foreground/90">
                {selected.highlights.map((item, index) => (
                  <li key={`${selected._id}-${index}`} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-auto space-y-3 pt-1">
              <Button asChild className="h-11 w-full rounded-xl text-sm font-semibold">
                <a
                  href={buildCheckoutUrl(selected.checkoutUrl, props.tier.tier, selected.durationDays)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Continue to checkout
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Need help after payment? Open{" "}
                <Link href="/checkout/return" className="underline underline-offset-4">
                  order status
                </Link>
                .
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-4 text-sm text-muted-foreground">
            No active options are available for this plan right now.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
