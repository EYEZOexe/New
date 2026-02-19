import Link from "next/link";
import { Check } from "lucide-react";

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
  const selected = props.selectedVariant;

  return (
    <Card className={`h-full rounded-3xl border border-border/70 bg-gradient-to-br ${getTierTheme(props.tier.tier)} p-6`}>
      <CardContent className="flex h-full flex-col gap-6 px-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{props.tier.title}</h2>
            {props.tier.badge ? <Badge variant="outline">{props.tier.badge}</Badge> : null}
          </div>
          {props.tier.subtitle ? <p className="text-sm font-medium text-foreground/90">{props.tier.subtitle}</p> : null}
          {props.tier.description ? <p className="text-sm text-muted-foreground">{props.tier.description}</p> : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Duration</p>
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
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Price</p>
              <p className="mt-2 text-4xl font-semibold leading-none">
                {selected.displayPrice}
                {selected.priceSuffix ? (
                  <span className="ml-1 text-base font-medium text-muted-foreground">{selected.priceSuffix}</span>
                ) : null}
              </p>
            </div>

            {selected.highlights.length > 0 ? (
              <ul className="space-y-2 rounded-2xl border border-border/70 bg-background/30 p-4 text-sm text-foreground/90">
                {selected.highlights.map((item, index) => (
                  <li key={`${selected._id}-${index}`} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-auto space-y-3">
              <Button asChild className="h-11 w-full rounded-xl text-sm font-semibold">
                <a
                  href={buildCheckoutUrl(selected.checkoutUrl, props.tier.tier, selected.durationDays)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Start {props.tier.title}
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Need help after checkout? Open{" "}
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
