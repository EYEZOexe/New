"use client";

import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth, useConvexConnectionState, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";

export default function DashboardPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const token = useAuthToken();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const backendIsAuthenticated = useQuery(api.auth.isAuthenticated);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Only redirect if we truly have no auth token at all. If there's a token
    // but Convex doesn't consider the client authenticated, render debug info.
    if (!isLoading && !isAuthenticated && token == null) {
      router.replace("/login?redirectTo=/dashboard");
    }
  }, [isAuthenticated, isLoading, router, token]);

  const tokenPreview = useMemo(() => {
    if (!token) return null;
    // Avoid printing the whole token in the UI.
    return `${token.slice(0, 12)}...${token.slice(-8)}`;
  }, [token]);

  async function onLogout() {
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      // Whether signOut succeeds or not, drop the user back to the homepage.
      router.replace("/");
      setIsLoggingOut(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600">Checking session...</p>
        </section>
      </main>
    );
  }

  // While redirecting to /login (token is null).
  if (!isAuthenticated && token == null) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-600">
              This page shows client auth state, backend auth state, and
              connection state.
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>

        <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <span>Auth state (useConvexAuth)</span>
            <span className="font-medium">
              {isAuthenticated ? "signed in" : "signed out"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <span>JWT present (provider)</span>
            <span className="font-mono text-xs">{tokenPreview ?? "null"}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <span>Backend `auth:isAuthenticated`</span>
            <span className="font-medium">
              {backendIsAuthenticated === undefined
                ? "loading"
                : backendIsAuthenticated
                  ? "true"
                  : "false"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <span>Connection</span>
            <span className="font-mono text-xs">
              {JSON.stringify(connectionState)}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm font-medium text-zinc-900 underline">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
