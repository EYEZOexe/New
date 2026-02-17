"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Bolt, ShieldCheck, TimerReset } from "lucide-react";
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
        actions={
          isAuthenticated ? (
            <Button size="sm" onClick={() => void signOut()}>
              Log out
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/signup">Create account</Link>
            </Button>
          )
        }
      />

      <Card className="site-panel">
        <CardContent className="space-y-6 px-0">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/shop">View plans</Link>
            </Button>
            {isAuthenticated ? (
              <Button asChild variant="outline">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="site-soft bg-cyan-500/10">
              <CardContent className="space-y-2 px-0">
                <Badge variant="outline">
                  <Bolt className="size-3" /> Realtime
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Convex subscriptions keep catalog, entitlement, and feed updates synchronized.
                </p>
              </CardContent>
            </Card>
            <Card className="site-soft bg-indigo-500/10">
              <CardContent className="space-y-2 px-0">
                <Badge variant="outline">
                  <TimerReset className="size-3" /> Tier-gated
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Channel visibility obeys subscription tier with hidden-by-default mapping rules.
                </p>
              </CardContent>
            </Card>
            <Card className="site-soft bg-emerald-500/10">
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

          <Card className="site-soft">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 px-0">
              <div>
                <p className="text-sm font-semibold">Session status</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isLoading && "Checking session..."}
                  {!isLoading && isAuthenticated && "Signed in and ready to view dashboard."}
                  {!isLoading &&
                    !isAuthenticated &&
                    "Signed out. Sign in to access dashboard feeds."}
                </p>
              </div>
              {!isAuthenticated ? (
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/signup">Sign up</Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
