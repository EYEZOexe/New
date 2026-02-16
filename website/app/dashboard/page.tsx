"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirectTo=/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  async function onLogout() {
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-600">You are signed in.</p>
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

        <div className="mt-6">
          <Link href="/" className="text-sm font-medium text-zinc-900 underline">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}

