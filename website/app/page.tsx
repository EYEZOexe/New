"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Activity, ArrowRight, Bolt, ShieldCheck, TimerReset } from "lucide-react";
import Link from "next/link";

import { PageFrame } from "@/components/site/page-frame";
import { SectionHeader } from "@/components/site/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <PageFrame>
      <SectionHeader
        badge="Sleep Crypto Console"
        title="Quiet signal intelligence for serious traders."
        subtitle="Dark, low-noise, realtime signal delivery across web and Discord. Pick a plan, sync entitlement, and track gated feed visibility without leaving the console."
        navLinks={[
          { href: "/shop", label: "Shop" },
          { href: "/dashboard", label: "Dashboard" },
        ]}
        highlights={[
          { label: "Delivery", value: "Realtime via Convex" },
          { label: "Access model", value: "Tier gated" },
          { label: "Identity", value: "Discord linked" },
        ]}
        actions={
          isAuthenticated ? (
            <Button size="sm" onClick={() => void signOut()} className="rounded-full px-4">
              Log out
            </Button>
          ) : (
            <Button size="sm" asChild className="rounded-full px-4">
              <Link href="/signup">Create account</Link>
            </Button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="site-panel">
          <CardContent className="space-y-6 px-0">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                One console for entitlement, feed access, and account state.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                Keep acquisition and delivery connected end-to-end. Customers can buy, return,
                link Discord, and confirm their tier visibility in a single flow.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-full px-5">
                <Link href="/shop">
                  View plans
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              {isAuthenticated ? (
                <Button asChild variant="outline" className="rounded-full px-5">
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="rounded-full px-5">
                  <Link href="/login">Log in</Link>
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="site-soft h-full bg-cyan-500/10">
                <CardContent className="space-y-2 px-0">
                  <Badge variant="outline">
                    <Bolt className="size-3" /> Realtime
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Convex subscriptions keep catalog, entitlement, and feed updates synchronized.
                  </p>
                </CardContent>
              </Card>
              <Card className="site-soft h-full bg-indigo-500/10">
                <CardContent className="space-y-2 px-0">
                  <Badge variant="outline">
                    <TimerReset className="size-3" /> Tier-gated
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Channel visibility obeys subscription tier with hidden-by-default mapping
                    rules.
                  </p>
                </CardContent>
              </Card>
              <Card className="site-soft h-full bg-emerald-500/10">
                <CardContent className="space-y-2 px-0">
                  <Badge variant="outline">
                    <ShieldCheck className="size-3" /> Policy-linked
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Checkout variants remain anchored to enabled Sell access policies.
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card className="site-panel">
          <CardContent className="space-y-5 px-0">
            <div className="flex items-center gap-2">
              <Badge
                variant={isAuthenticated ? "secondary" : "outline"}
                className={isAuthenticated ? "bg-emerald-500/20 text-emerald-100" : undefined}
              >
                <Activity className="size-3" />
                {isLoading ? "Checking session" : isAuthenticated ? "Session active" : "Signed out"}
              </Badge>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {isLoading && "Validating your identity and current entitlement state."}
              {!isLoading && isAuthenticated && "Signed in and ready to view dashboard feeds."}
              {!isLoading &&
                !isAuthenticated &&
                "Sign in to access tier-gated feed visibility and Discord link controls."}
            </p>

            <div className="site-soft space-y-3">
              <p className="site-kicker">Next Step</p>
              <p className="text-sm text-foreground/90">
                {isAuthenticated
                  ? "Review channel visibility and Discord link status in your dashboard."
                  : "Create an account, pick a plan, and unlock your signal workspace."}
              </p>
            </div>

            {!isAuthenticated ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full px-4">
                  <Link href="/signup">Create account</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-full px-4">
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
            ) : (
              <Button asChild size="sm" variant="outline" className="w-fit rounded-full px-4">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
