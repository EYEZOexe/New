"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { makeFunctionReference } from "convex/server";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowRight,
  ChartColumn,
  CheckCircle2,
  NotebookPen,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { MarketingFrame } from "@/components/site/marketing-frame";
import { MarketingNav } from "@/components/site/marketing-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const executionSteps = [
  {
    title: "Choose your plan",
    description: "Pick a tier and duration that matches your trading cadence.",
  },
  {
    title: "Get immediate access",
    description: "Your account updates quickly so you can start without delays.",
  },
  {
    title: "Trade and review",
    description: "Use signals and your journal together to improve execution quality.",
  },
] as const;

const valuePoints = [
  {
    title: "Curated trade signals",
    description: "Setups are structured for faster decision-making.",
    icon: ChartColumn,
  },
  {
    title: "Built-in journal",
    description: "Track entries, exits, and consistency in one workspace.",
    icon: NotebookPen,
  },
  {
    title: "Secure member access",
    description: "Account access and plan visibility stay clean and predictable.",
    icon: ShieldCheck,
  },
] as const;

const publicLandingSnapshotRef = makeFunctionReference<
  "query",
  Record<string, never>,
  {
    marketCount: number;
    lastMarketUpdateAt: number | null;
    topGainer: { symbol: string; change24h: number; price: number } | null;
    topVolume: { symbol: string; volume24h: number; change24h: number } | null;
    latestNews: Array<{ title: string; source: string; url: string; publishedAt: number }>;
  }
>("workspace:publicLandingSnapshot");

function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatRelativeTime(timestamp: number | null | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "No update";
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Home() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const landingSnapshot = useQuery(publicLandingSnapshotRef, {});

  useEffect(() => {
    if (!landingSnapshot) return;
    console.info(
      `[website/home] snapshot markets=${landingSnapshot.marketCount} news=${landingSnapshot.latestNews.length} top_gainer=${landingSnapshot.topGainer?.symbol ?? "none"}`,
    );
  }, [landingSnapshot]);

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
              <Link href="/signup">Start free</Link>
            </Button>
          )
        }
      />

      <section className="site-panel grid gap-8 xl:grid-cols-[1.06fr_0.94fr]">
        <div className="space-y-6">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit rounded-full bg-cyan-500/20 text-cyan-100">
              Trading Platform
            </Badge>
            <h1 className="site-title max-w-3xl text-4xl md:text-6xl">Signal clarity for serious traders.</h1>
            <p className="site-subtitle max-w-2xl">
              Replace noisy feeds with a focused trading workspace. Get clear setups, track performance,
              and keep your process consistent.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-11 rounded-full px-6 text-sm">
              <Link href="/shop">
                View pricing
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full px-6 text-sm">
              <Link href={isAuthenticated ? "/dashboard" : "/login"}>
                {isAuthenticated ? "Open dashboard" : "Log in"}
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="site-stat">
              <p className="site-kicker">Tracked markets</p>
              <p className="mt-2 text-2xl font-semibold">
                {landingSnapshot ? landingSnapshot.marketCount : "Loading"}
              </p>
            </div>
            <div className="site-stat">
              <p className="site-kicker">Top 24h mover</p>
              <p className="mt-2 text-2xl font-semibold">
                {landingSnapshot?.topGainer
                  ? `${landingSnapshot.topGainer.symbol} ${formatSignedPercent(landingSnapshot.topGainer.change24h)}`
                  : "No live data"}
              </p>
            </div>
            <div className="site-stat">
              <p className="site-kicker">Feed freshness</p>
              <p className="mt-2 text-2xl font-semibold">
                {landingSnapshot ? formatRelativeTime(landingSnapshot.lastMarketUpdateAt) : "Loading"}
              </p>
            </div>
          </div>
        </div>

        <Card className="rounded-3xl border border-border/70 bg-background/55 p-5">
          <CardContent className="space-y-5 px-0">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/55 px-4 py-3">
              <p className="text-sm font-medium">Live workspace snapshot</p>
              <Badge className="rounded-full bg-emerald-500/20 text-emerald-200">
                {landingSnapshot ? formatRelativeTime(landingSnapshot.lastMarketUpdateAt) : "Loading"}
              </Badge>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="site-kicker">Today’s highlights</p>
              <div className="space-y-2">
                {landingSnapshot?.latestNews.slice(0, 2).map((article) => (
                  <a
                    key={article.url}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:bg-background/65"
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <p className="text-sm font-semibold">{article.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {article.source} • {formatRelativeTime(article.publishedAt)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-cyan-300">Open</span>
                  </a>
                ))}
                {landingSnapshot?.topVolume ? (
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 p-3">
                    <div>
                      <p className="text-sm font-semibold">{landingSnapshot.topVolume.symbol} leads volume</p>
                      <p className="text-xs text-muted-foreground">
                        24h change {formatSignedPercent(landingSnapshot.topVolume.change24h)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-300">Live</span>
                  </div>
                ) : null}
                {!landingSnapshot ? (
                  <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
                    Loading market snapshot...
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="site-kicker">Execution loop</p>
              {[
                "Check live signal context",
                "Execute with your plan",
                "Log and review performance",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="size-4 text-cyan-300" />
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {valuePoints.map((item) => (
          <Card key={item.title} className="rounded-2xl border border-border/70 bg-card/75 p-5">
            <CardContent className="space-y-3 px-0">
              <div className="inline-flex size-9 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/15">
                <item.icon className="size-4 text-cyan-200" />
              </div>
              <p className="text-xl font-semibold tracking-tight">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="site-panel space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="site-kicker">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">A cleaner trading workflow in 3 steps.</h2>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
            <Sparkles className="mr-1 size-3.5" />
            Built for active execution
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {executionSteps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-border/70 bg-background/55 p-4">
              <p className="site-kicker">Step {index + 1}</p>
              <p className="mt-2 text-xl font-semibold">{step.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingFrame>
  );
}
