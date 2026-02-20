import Link from "next/link";
import { Check, Sparkles, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type {
  CatalogTier,
  CatalogVariant,
  SubscriptionTier,
} from "../types";
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

function getTierPalette(tier: CatalogTier["tier"]) {
  if (tier === "basic") {
    return {
      glow: "bg-cyan-400/22",
      badge: "border-cyan-300/40 bg-cyan-400/18 text-cyan-100",
      accentText: "text-cyan-200",
      accentBorder: "border-cyan-300/35",
      accentSurface: "bg-cyan-400/10",
      cta: "bg-cyan-500 text-cyan-50 hover:bg-cyan-400",
      softRing: "shadow-[0_26px_65px_-44px_rgba(36,201,255,0.95)]",
    };
  }
  if (tier === "advanced") {
    return {
      glow: "bg-amber-400/20",
      badge: "border-amber-300/45 bg-amber-400/18 text-amber-100",
      accentText: "text-amber-200",
      accentBorder: "border-amber-300/35",
      accentSurface: "bg-amber-400/10",
      cta: "bg-amber-500 text-amber-50 hover:bg-amber-400",
      softRing: "shadow-[0_26px_65px_-44px_rgba(255,181,60,0.95)]",
    };
  }
  return {
    glow: "bg-fuchsia-400/22",
    badge: "border-fuchsia-300/45 bg-fuchsia-400/18 text-fuchsia-100",
    accentText: "text-fuchsia-200",
    accentBorder: "border-fuchsia-300/35",
    accentSurface: "bg-fuchsia-400/10",
    cta: "bg-fuchsia-500 text-fuchsia-50 hover:bg-fuchsia-400",
    softRing: "shadow-[0_26px_65px_-44px_rgba(247,107,255,0.95)]",
  };
}

const DEFAULT_TIER_COPY: Record<
  SubscriptionTier,
  {
    subtitle: string;
    description: string;
    highlights: string[];
  }
> = {
  basic: {
    subtitle: "Clean signal flow for traders building consistency.",
    description:
      "A focused starting plan for daily execution with clear setups and practical market context.",
    highlights: [
      "Structured signal feed with straightforward entries",
      "Core dashboard modules for market direction",
      "Fast onboarding without unnecessary complexity",
    ],
  },
  advanced: {
    subtitle: "More depth for higher-frequency decision-making.",
    description:
      "Built for active traders who want stronger confirmation layers and richer context before entering.",
    highlights: [
      "Expanded signal coverage with deeper setup detail",
      "Stronger confirmation context across key modules",
      "Improved trade-planning confidence per session",
    ],
  },
  pro: {
    subtitle: "Full-stack access for traders who want maximum control.",
    description:
      "Designed for power users who need full visibility, premium signal depth, and flexible plan windows.",
    highlights: [
      "Complete access to premium signal coverage",
      "Highest-context market view across the workspace",
      "Flexible durations including trial and full monthly access",
    ],
  },
};

function isFreeVariant(variant: CatalogVariant): boolean {
  return /\$?\s*0(?:\.0{1,2})?/.test(variant.displayPrice.replace(/\s+/g, ""));
}

export function ShopTierCard(props: ShopTierCardProps) {
  const selected = props.selectedVariant;
  const tierIsFeatured = props.tier.variants.some((variant) => variant.isFeatured);
  const palette = getTierPalette(props.tier.tier);
  const tierCopy = DEFAULT_TIER_COPY[props.tier.tier];
  const subtitle = props.tier.subtitle?.trim() || tierCopy.subtitle;
  const description = props.tier.description?.trim() || tierCopy.description;
  const highlights =
    selected && selected.highlights.length > 0 ? selected.highlights : tierCopy.highlights;

  return (
    <Card
      className={cn(
        "site-card-hover relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card/85",
        palette.softRing,
      )}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getTierAccentClass(props.tier.tier)}`} />
      <div className={cn("pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full blur-3xl", palette.glow)} />
      <CardContent className="relative z-10 flex h-full flex-col gap-5 p-6">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tier Access</p>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-3xl font-semibold leading-none tracking-tight">{props.tier.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {tierIsFeatured ? (
                <Badge className={cn("rounded-full", palette.badge)}>
                  <Sparkles className="mr-1 size-3.5" />
                  Most chosen
                </Badge>
              ) : null}
              {props.tier.badge ? (
                <Badge variant="outline" className={cn("rounded-full", palette.accentBorder, palette.accentText)}>
                  {props.tier.badge}
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="max-w-[44ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-2.5">
          <p className="site-kicker">Pick Duration</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {props.tier.variants.map((variant) => (
              <button
                key={variant._id}
                type="button"
                className={cn(
                  "group relative rounded-2xl border px-3 py-2.5 text-left transition-all",
                  selected?.durationDays === variant.durationDays
                    ? cn(
                        "border-border/80 bg-background/65",
                        palette.accentBorder,
                        palette.accentSurface,
                        "ring-1 ring-white/10",
                      )
                    : "border-border/70 bg-background/35 hover:border-border/90 hover:bg-background/50",
                )}
                onClick={() => props.onSelectDuration(variant.durationDays)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {variant.durationDays} days
                    {isFreeVariant(variant) ? " trial" : ""}
                  </span>
                  {selected?.durationDays === variant.durationDays ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        palette.accentBorder,
                        palette.accentText,
                      )}
                    >
                      Selected
                    </span>
                  ) : null}
                </div>
                {variant.isFeatured ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="size-3.5" />
                    Best value
                  </span>
                ) : isFreeVariant(variant) ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="size-3.5" />
                    Free starter access
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {selected ? (
          <>
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border px-4 py-4",
                "border-border/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]",
                palette.accentBorder,
                palette.accentSurface,
              )}
            >
              <div className="pointer-events-none absolute -left-6 bottom-0 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
              <p className="site-kicker">Selected Billing</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-4xl font-semibold leading-none md:text-[2.7rem]">
                  {selected.displayPrice}
                  {selected.priceSuffix ? (
                    <span className="ml-1 text-base font-medium text-muted-foreground">{selected.priceSuffix}</span>
                  ) : null}
                </p>
                <Badge variant="outline" className={cn("rounded-full", palette.accentBorder, palette.accentText)}>
                  {selected.durationDays} days
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                One-time payment. Access activates automatically after checkout confirmation.
              </p>
            </div>

            <ul className="space-y-2 text-sm text-foreground/90">
              {highlights.map((item, index) => (
                <li
                  key={`${props.tier.tier}-${selected._id}-${index}`}
                  className="flex items-start gap-2 rounded-xl border border-border/55 bg-background/30 px-2.5 py-2"
                >
                  <Check className={cn("mt-0.5 size-4 shrink-0", palette.accentText)} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-3 pt-1">
              <Button asChild className={cn("h-11 w-full rounded-xl text-sm font-semibold", palette.cta)}>
                <a
                  href={buildCheckoutUrl(selected.checkoutUrl, props.tier.tier, selected.durationDays)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Start {props.tier.title}
                </a>
              </Button>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Need help after payment?</span>
                <Link href="/checkout/return" className="underline underline-offset-4 hover:text-foreground">
                  Open order status
                </Link>
              </div>
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
