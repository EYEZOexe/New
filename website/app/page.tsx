"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";

export default function Home() {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">
          G3netic Website
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Convex auth is enabled for this app.
        </p>

        <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          {isLoading && "Checking session..."}
          {!isLoading && isAuthenticated && "You are signed in."}
          {!isLoading && !isAuthenticated && "You are signed out."}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {!isAuthenticated ? (
            <>
              <Link
                href="/login"
                className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-900"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white"
              >
                Go to dashboard
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
