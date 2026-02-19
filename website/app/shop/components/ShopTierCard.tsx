import Link from "next/link";
import { CircleCheckBig } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { CatalogTier, CatalogVariant } from "../types";
import { buildCheckoutUrl, getTierTheme } from "../utils";

type ShopTierCardProps = {
  tier: CatalogTier;
  selectedVariant: CatalogVariant | null;
  onSelectDuration: (durationDays: number) => void;
};

export function ShopTierCard(props: ShopTierCardProps) {
  const tier = props.tier;
  const selectedDuration = props.selectedVariant?.durationDays ?? null;

  return (
    <Card
      className={`site-panel h-full border-border/70 bg-gradient-to-br ${getTierTheme(
        tier.tier,
      )}`}
    >
      <CardContent className="flex h-full flex-col gap-6 px-0">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xl font-semibold">{tier.title}</p>
            {tier.badge ? <Badge variant="outline">{tier.badge}</Badge> : null}
          </div>
          {tier.subtitle ? <p className="text-sm font-medium text-foreground/90">{tier.subtitle}</p> : null}
          {tier.description ? <p className="text-sm text-muted-foreground">{tier.description}</p> : null}
        </div>

        <div className="space-y-2">
          <p className="site-kicker">Duration</p>
          <div className="flex flex-wrap gap-2">
            {tier.variants.map((variant) => (
              <Button
                key={variant._id}
                type="button"
                size="sm"
                variant={variant.durationDays === selectedDuration ? "default" : "outline"}
                className="rounded-full px-4"
                onClick={() => props.onSelectDuration(variant.durationDays)}
              >
                {variant.durationDays}d
              </Button>
            ))}
          </div>
        </div>

        {props.selectedVariant ? (
          <>
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <p className="site-kicker">Current price</p>
              <p className="mt-2 text-4xl font-semibold leading-none">
                {props.selectedVariant.displayPrice}
                {props.selectedVariant.priceSuffix ? (
                  <span className="ml-1 text-base font-medium text-muted-foreground">
                    {props.selectedVariant.priceSuffix}
                  </span>
                ) : null}
              </p>
            </div>

            {props.selectedVariant.highlights.length > 0 ? (
              <ul className="space-y-2 rounded-2xl border border-border/70 bg-background/30 p-4 text-sm text-foreground/90">
                {props.selectedVariant.highlights.map((highlight, index) => (
                  <li key={`${props.selectedVariant?._id}-${index}`} className="flex items-start gap-2">
                    <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-auto space-y-3">
              <Button asChild className="h-11 w-full rounded-xl text-sm font-semibold">
                <a
                  href={buildCheckoutUrl(
                    props.selectedVariant.checkoutUrl,
                    tier.tier,
                    props.selectedVariant.durationDays,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Checkout {tier.title}
                </a>
              </Button>

              <div className="rounded-2xl border border-border/70 bg-background/35 p-3 text-xs text-muted-foreground">
                Tier {tier.tier.toUpperCase()} • {props.selectedVariant.durationDays} days • Policy-linked entitlement confirmation follows checkout return state.
              </div>

              <p className="text-xs text-muted-foreground">
                After payment, open{" "}
                <Link href="/checkout/return" className="underline underline-offset-4">
                  checkout status
                </Link>{" "}
                for realtime entitlement confirmation.
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/25 p-4 text-sm text-muted-foreground">
            No active duration variants are currently available.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
