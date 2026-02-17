"use client";

import { makeFunctionReference } from "convex/server";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageFrame } from "@/components/site/page-frame";
import { SectionHeader } from "@/components/site/section-header";
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

  useEffect(() => {
    if (!viewer) return;
    console.info(
      `[checkout-return] state=${status} expected_tier=${expectedTier ?? "none"} actual_tier=${viewer.tier ?? "none"} subscription=${viewer.subscriptionStatus ?? "none"} has_access=${viewer.hasSignalAccess}`,
    );
  }, [viewer, status, expectedTier]);

  return (
    <PageFrame>
      <SectionHeader
        badge="Checkout Return"
        title="Entitlement status in realtime."
        subtitle="Keep this tab open while Convex confirms your subscription state from Sell webhook processing."
        navLinks={[
          { href: "/shop", label: "Shop" },
          { href: "/dashboard", label: "Dashboard" },
        ]}
      />

      <Card className="site-panel">
        <CardContent className="space-y-4 px-0">
          {status === "pending" ? (
            <Alert>
              <AlertTitle>Payment is still processing.</AlertTitle>
              <AlertDescription>
                Your access will switch to active automatically when entitlement updates.
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "success" ? (
            <Alert className="border-emerald-400/40 bg-emerald-500/10">
              <AlertTitle className="text-emerald-200">Access activated successfully.</AlertTitle>
              <AlertDescription className="space-y-1 text-emerald-100/90">
                <p>
                  Current tier: {viewer?.tier ?? "unknown"}
                  {expectedTier ? ` (checkout target: ${expectedTier})` : ""}.
                </p>
                {viewer?.subscriptionEndsAt ? (
                  <p>Expires: {new Date(viewer.subscriptionEndsAt).toLocaleString()}</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "failure" ? (
            <Alert variant="destructive">
              <AlertTitle>Access could not be activated.</AlertTitle>
              <AlertDescription>
                Subscription status is currently {viewer?.subscriptionStatus ?? "unknown"}.
                Return to shop and verify checkout details.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">State: {status}</Badge>
            {expectedTier ? <Badge variant="outline">Expected tier: {expectedTier}</Badge> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/shop">Back to shop</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
