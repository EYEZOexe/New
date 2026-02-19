import Link from "next/link";

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
      className={`site-panel border-border/70 bg-gradient-to-br ${getTierTheme(
        tier.tier,
      )}`}
    >
      <CardContent className="space-y-5 px-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xl font-semibold">{tier.title}</p>
          {tier.badge ? <Badge variant="outline">{tier.badge}</Badge> : null}
        </div>
        {tier.subtitle ? <p className="text-sm font-medium text-foreground/90">{tier.subtitle}</p> : null}
        {tier.description ? <p className="text-sm text-muted-foreground">{tier.description}</p> : null}

        <div className="flex flex-wrap gap-2">
          {tier.variants.map((variant) => (
            <Button
              key={variant._id}
              type="button"
              size="sm"
              variant={
                variant.durationDays === selectedDuration ? "default" : "outline"
              }
              className="rounded-full px-4"
              onClick={() => props.onSelectDuration(variant.durationDays)}
            >
              {variant.durationDays}d
            </Button>
          ))}
        </div>

        {props.selectedVariant ? (
          <div className="space-y-3">
            <p className="text-3xl font-semibold">
              {props.selectedVariant.displayPrice}
              {props.selectedVariant.priceSuffix ? (
                <span className="ml-1 text-base font-medium text-muted-foreground">
                  {props.selectedVariant.priceSuffix}
                </span>
              ) : null}
            </p>

            {props.selectedVariant.highlights.length > 0 ? (
              <ul className="site-soft space-y-1 text-sm text-foreground/90">
                {props.selectedVariant.highlights.map((highlight, index) => (
                  <li key={`${props.selectedVariant?._id}-${index}`}>• {highlight}</li>
                ))}
              </ul>
            ) : null}

            <Button asChild className="w-full rounded-xl">
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
            <div className="site-soft space-y-1 text-xs text-muted-foreground">
              <p>Tier: {tier.tier.toUpperCase()}</p>
              <p>Duration: {props.selectedVariant.durationDays} days</p>
              <p>Policy-linked entitlement confirmation follows checkout return state.</p>
            </div>
            <p className="text-xs text-muted-foreground">
              After payment, open{" "}
              <Link href="/checkout/return" className="underline underline-offset-4">
                checkout status
              </Link>{" "}
              for realtime entitlement confirmation.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active duration variants are currently available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
