"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { ArrowRight, ChartLine, ShieldCheck, Timer } from "lucide-react";
import Link from "next/link";

import { MarketingFrame } from "@/components/site/marketing-frame";
import { MarketingNav } from "@/components/site/marketing-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
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
              <Link href="/signup">Start free</Link>
            </Button>
          )
        }
      />

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-8">
          <CardContent className="space-y-6 px-0">
            <div className="space-y-4">
              <Badge variant="secondary" className="rounded-full bg-cyan-500/20 text-cyan-100">
                Crypto Signals SaaS
              </Badge>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Trade with structure.
                <br />
                Not noise.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Get curated trade signals, journal your execution, and track performance in one focused workspace built for active traders.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-11 rounded-full px-6 text-sm">
                <Link href="/shop">
                  View plans
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
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Traders onboarded</p>
                <p className="mt-2 text-2xl font-semibold">2,100+</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Avg setup time</p>
                <p className="mt-2 text-2xl font-semibold">Under 3 min</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Uptime</p>
                <p className="mt-2 text-2xl font-semibold">99.9%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-8">
          <CardContent className="space-y-4 px-0">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Why teams switch</p>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <ChartLine className="size-4 text-cyan-300" />
                  Higher signal quality
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Actionable setups, not spam feeds.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="size-4 text-cyan-300" />
                  Clean access control
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Every plan unlocks exactly what it should.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <Timer className="size-4 text-cyan-300" />
                  Faster decision loop
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Signals, notes, and tracking in one place.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border border-border/70 bg-card/80 p-5">
          <CardContent className="space-y-2 px-0">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Step 1</p>
            <p className="text-xl font-semibold">Pick your plan</p>
            <p className="text-sm text-muted-foreground">Choose tier and duration that match your trading style.</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/70 bg-card/80 p-5">
          <CardContent className="space-y-2 px-0">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Step 2</p>
            <p className="text-xl font-semibold">Get access instantly</p>
            <p className="text-sm text-muted-foreground">Your account updates quickly so you can start right away.</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/70 bg-card/80 p-5">
          <CardContent className="space-y-2 px-0">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Step 3</p>
            <p className="text-xl font-semibold">Trade and journal</p>
            <p className="text-sm text-muted-foreground">Review signals, log trades, and improve consistency.</p>
          </CardContent>
        </Card>
      </section>
    </MarketingFrame>
  );
}
