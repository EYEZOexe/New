"use client";

import { makeFunctionReference } from "convex/server";
import { useConvexAuth, useQuery } from "convex/react";
import { CheckCircle2, Clock3, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { normalizeCheckoutPortalUrl } from "@/app/shop/utils";
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

type CheckoutLaunchMode = "opened" | "blocked" | "unknown";

const SUCCESS_REDIRECT_SECONDS = 8;
const FAILURE_REDIRECT_SECONDS = 10;

function getTierFromSearch(value: string | null): SubscriptionTier | null {
  if (value === "basic" || value === "advanced" || value === "pro") return value;
  return null;
}

function getLaunchModeFromSearch(value: string | null): CheckoutLaunchMode {
  if (value === "opened" || value === "blocked") return value;
  return "unknown";
}

function getDurationFromSearch(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function CheckoutReturnPage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [expectedTier, setExpectedTier] = useState<SubscriptionTier | null>(null);
  const [expectedDurationDays, setExpectedDurationDays] = useState<number | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [launchMode, setLaunchMode] = useState<CheckoutLaunchMode>("unknown");
  const [refreshHref, setRefreshHref] = useState("/checkout/return");
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

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
    setExpectedDurationDays(getDurationFromSearch(params.get("duration_days")));
    setCheckoutUrl(normalizeCheckoutPortalUrl(params.get("checkout_url")));
    setLaunchMode(getLaunchModeFromSearch(params.get("launch")));
    const rawParams = params.toString();
    setRefreshHref(rawParams ? `/checkout/return?${rawParams}` : "/checkout/return");
  }, []);

  const status: "pending" | "success" | "failure" = (() => {
    if (!isAuthenticated || !viewer) return "pending";
    if (viewer.hasSignalAccess) return "success";
    if (viewer.subscriptionStatus === "canceled" || viewer.subscriptionStatus === "past_due") {
      return "failure";
    }
    return "pending";
  })();

  const redirectTarget = status === "success" ? "/dashboard" : "/shop";
  const redirectSeconds =
    status === "success" ? SUCCESS_REDIRECT_SECONDS : FAILURE_REDIRECT_SECONDS;

  useEffect(() => {
    if (status !== "success" && status !== "failure") {
      setRedirectCountdown(null);
      return;
    }

    console.info(
      `[checkout/return] auto redirect scheduled status=${status} target=${redirectTarget} seconds=${redirectSeconds}`,
    );
    const startedAt = Date.now();
    setRedirectCountdown(redirectSeconds);
    const interval = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setRedirectCountdown(Math.max(0, redirectSeconds - elapsedSeconds));
    }, 250);
    const timeout = window.setTimeout(() => {
      console.info(
        `[checkout/return] auto redirect executing status=${status} target=${redirectTarget}`,
      );
      router.replace(redirectTarget);
    }, redirectSeconds * 1000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [redirectSeconds, redirectTarget, router, status]);

  useEffect(() => {
    console.info(
      `[checkout/return] status=${status} tier_expected=${expectedTier ?? "none"} tier_current=${viewer?.tier ?? "none"} launch_mode=${launchMode} checkout_url=${checkoutUrl ? "present" : "missing"}`,
    );
  }, [checkoutUrl, expectedTier, launchMode, status, viewer?.tier]);

  const handleOpenCheckoutPortal = useCallback(() => {
    if (!checkoutUrl || typeof window === "undefined") return;
    const popup = window.open(checkoutUrl, "_blank");
    if (popup) {
      popup.opener = null;
      console.info("[checkout/return] checkout portal opened in new tab");
      return;
    }
    console.warn("[checkout/return] popup blocked, navigating current tab to checkout portal");
    window.location.assign(checkoutUrl);
  }, [checkoutUrl]);

  const pendingCopy =
    launchMode === "opened"
      ? "Checkout should be open in a separate tab. Complete payment there and this page will update automatically."
      : launchMode === "blocked"
        ? "Your browser blocked automatic checkout launch. Use the button below to open the checkout portal."
        : "Complete payment in Sell checkout and keep this page open while we activate your access.";

  return (
    <MarketingFrame>
      <MarketingNav />

      <section className="site-panel site-animate-in grid gap-6 xl:grid-cols-[1fr_330px] xl:items-start">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="site-kicker">Checkout status</p>
            <h1 className="site-title text-4xl md:text-6xl">Confirming your account access.</h1>
            <p className="site-subtitle">
              Keep this page open while we finalize your payment and activate your plan.
            </p>
          </div>

          {status === "pending" ? (
            <Alert>
              <Clock3 className="size-4" />
              <AlertTitle>Still processing</AlertTitle>
              <AlertDescription>{pendingCopy}</AlertDescription>
            </Alert>
          ) : null}

          {status === "success" ? (
            <Alert className="border-emerald-400/40 bg-emerald-500/10">
              <CheckCircle2 className="size-4 text-emerald-300" />
              <AlertTitle className="text-emerald-200">Access is active</AlertTitle>
              <AlertDescription className="text-emerald-100/90">
                Your plan is live. Redirecting to dashboard automatically in{" "}
                {redirectCountdown ?? SUCCESS_REDIRECT_SECONDS}s.
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "failure" ? (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Activation incomplete</AlertTitle>
              <AlertDescription>
                We could not activate access yet. Redirecting back to pricing in{" "}
                {redirectCountdown ?? FAILURE_REDIRECT_SECONDS}s.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {checkoutUrl ? (
              <Button
                type="button"
                variant={launchMode === "blocked" ? "default" : "outline"}
                className="rounded-full px-5"
                onClick={handleOpenCheckoutPortal}
              >
                <ExternalLink className="size-4" />
                Open checkout
              </Button>
            ) : null}
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/shop">Back to pricing</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link href={status === "failure" ? "/shop" : "/dashboard"}>
                {status === "failure" ? "Retry plans" : "Open dashboard"}
              </Link>
            </Button>
          </div>
        </div>

        <Card className="site-card-hover rounded-2xl border border-border/70 bg-background/45 p-4">
          <CardContent className="space-y-3 px-0 text-sm">
            <p className="site-kicker">Status details</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full">Status: {status}</Badge>
              {expectedTier ? <Badge variant="outline" className="rounded-full">Selected: {expectedTier}</Badge> : null}
              {expectedDurationDays ? (
                <Badge variant="outline" className="rounded-full">
                  Duration: {expectedDurationDays} days
                </Badge>
              ) : null}
              <Badge variant="outline" className="rounded-full">Launch: {launchMode}</Badge>
              {viewer?.tier ? <Badge variant="outline" className="rounded-full">Current: {viewer.tier}</Badge> : null}
            </div>
            <p className="text-muted-foreground">
              {status === "pending"
                ? "If confirmation takes longer than expected, refresh this page or reopen checkout."
                : `Auto-redirect target: ${redirectTarget}`}
            </p>
            <Button asChild variant="ghost" className="w-full rounded-xl border border-border/70">
              <Link href={refreshHref}>
                <RefreshCw className="size-4" />
                Refresh status
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </MarketingFrame>
  );
}
