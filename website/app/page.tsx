"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";

export default function Home() {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <main className="site-shell">
      <section className="site-wrap">
        <div className="site-surface">
          <p className="site-chip">G3netic Signals</p>
          <h1 className="site-title mt-4">Premium crypto signal intelligence.</h1>
          <p className="site-subtitle">
            Tiered, realtime signal delivery with strict policy-backed access controls and
            Discord-ready operations. Choose your tier, launch checkout, and unlock your dashboard
            instantly when entitlement activates.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className="site-btn-primary">
              View plans
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard" className="site-btn-secondary">
                Open dashboard
              </Link>
            ) : (
              <Link href="/signup" className="site-btn-secondary">
                Create account
              </Link>
            )}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="site-surface-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Realtime
              </p>
              <p className="mt-2 text-sm text-slate-800">
                Live Convex-powered updates from shop catalog changes through dashboard entitlement.
              </p>
            </article>
            <article className="site-surface-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Tiered access
              </p>
              <p className="mt-2 text-sm text-slate-800">
                Basic, advanced, and pro visibility controls for dashboard channel intelligence.
              </p>
            </article>
            <article className="site-surface-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Policy-safe
              </p>
              <p className="mt-2 text-sm text-slate-800">
                Checkout variants are linked to enabled Sell access policies before publish.
              </p>
            </article>
          </div>
        </div>

        <div className="site-surface flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Session status</p>
            <p className="mt-1 text-sm text-slate-600">
              {isLoading && "Checking session..."}
              {!isLoading && isAuthenticated && "Signed in and ready to view dashboard."}
              {!isLoading && !isAuthenticated && "Signed out. Sign in to access dashboard feeds."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isAuthenticated ? (
              <>
                <Link href="/login" className="site-link">
                  Log in
                </Link>
                <Link href="/signup" className="site-link">
                  Sign up
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void signOut()}
                className="site-btn-secondary h-10"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
