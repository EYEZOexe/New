"use client";

import { makeFunctionReference } from "convex/server";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
    <main className="site-shell">
      <section className="site-wrap">
        <div className="site-surface">
          <p className="site-chip">Checkout Return</p>
          <h1 className="site-title mt-4">Validating your access...</h1>
          <p className="site-subtitle">
            This page updates in realtime as subscription state changes in Convex after checkout.
          </p>

          <div className="mt-6 site-surface-soft">
            {status === "pending" ? (
              <>
                <p className="text-sm font-semibold text-slate-900">Payment is being processed.</p>
                <p className="mt-2 text-sm text-slate-600">
                  Keep this page open. We’ll switch to success automatically when entitlement is
                  active.
                </p>
              </>
            ) : null}

            {status === "success" ? (
              <>
                <p className="text-sm font-semibold text-emerald-700">
                  Access activated successfully.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Current tier: {viewer?.tier ?? "unknown"}
                  {expectedTier ? ` (checkout target: ${expectedTier})` : ""}.
                </p>
                {viewer?.subscriptionEndsAt ? (
                  <p className="mt-1 text-sm text-slate-600">
                    Expires: {new Date(viewer.subscriptionEndsAt).toLocaleString()}
                  </p>
                ) : null}
              </>
            ) : null}

            {status === "failure" ? (
              <>
                <p className="text-sm font-semibold text-red-700">
                  Access could not be activated.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Subscription status is currently {viewer?.subscriptionStatus ?? "unknown"}.
                  Return to shop and verify your checkout details.
                </p>
              </>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/shop" className="site-btn-secondary">
              Back to shop
            </Link>
            <Link href="/dashboard" className="site-btn-primary">
              Open dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
