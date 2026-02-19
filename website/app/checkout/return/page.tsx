"use client";

import { makeFunctionReference } from "convex/server";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MarketingFrame } from "@/components/site/marketing-frame";
import { MarketingNav } from "@/components/site/marketing-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SubscriptionTier = "basic" | "advanced" | "pro";

type ViewerRow = {
  userId: string;
  tier: SubscriptionTier | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  subscriptionEndsAt: number | null;
  hasSignalAccess: boolean;
};

function getTierFromSearch(value: string | null): SubscriptionTier | null {
  if (value === "basic" || value === "advanced" || value === "pro") return value;
  return null;
}

export default function CheckoutReturnPage() {
  const { isAuthenticated } = useConvexAuth();
  const [expectedTier, setExpectedTier] = useState<SubscriptionTier | null>(null);

  const viewerRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, ViewerRow | null>("users:viewer"),
    [],
  );
  const viewer = useQuery(viewerRef, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setExpectedTier(getTierFromSearch(params.get("tier")));
  }, []);

  const status: "pending" | "success" | "failure" = (() => {
    if (!isAuthenticated || !viewer) return "pending";
    if (viewer.hasSignalAccess) return "success";
    if (viewer.subscriptionStatus === "canceled" || viewer.subscriptionStatus === "past_due") {
      return "failure";
    }
    return "pending";
  })();

  return (
    <MarketingFrame>
      <MarketingNav />

      <Card className="rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-8">
        <CardContent className="space-y-5 px-0">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Order status</p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">We’re confirming your access.</h1>
            <p className="text-base text-muted-foreground">
              Keep this page open for a moment while your purchase is finalized.
            </p>
          </div>

          {status === "pending" ? (
            <Alert>
              <AlertTitle>Still processing</AlertTitle>
              <AlertDescription>Your account will update automatically as soon as payment is confirmed.</AlertDescription>
            </Alert>
          ) : null}

          {status === "success" ? (
            <Alert className="border-emerald-400/40 bg-emerald-500/10">
              <AlertTitle className="text-emerald-200">Access is active</AlertTitle>
              <AlertDescription className="text-emerald-100/90">
                You can now open your dashboard and start using your plan.
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "failure" ? (
            <Alert variant="destructive">
              <AlertTitle>We couldn’t activate access yet</AlertTitle>
              <AlertDescription>
                Please return to pricing and verify payment details or contact support.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">Status: {status}</Badge>
            {expectedTier ? <Badge variant="outline">Selected plan: {expectedTier}</Badge> : null}
            {viewer?.tier ? <Badge variant="outline">Current tier: {viewer.tier}</Badge> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/shop">Back to pricing</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </MarketingFrame>
  );
}
