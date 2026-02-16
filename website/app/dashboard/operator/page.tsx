"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type OperatorPaymentRow = {
  provider: string;
  userId: string;
  userEmail: string | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  customerEmail: string | null;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  lastEventId: string | null;
  updatedAt: number;
};

export default function OperatorPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useMemo(() => search.trim(), [search]);

  const listPaymentCustomersRef = makeFunctionReference<
    "query",
    { limit?: number; search?: string },
    OperatorPaymentRow[]
  >("payments:listPaymentCustomers");

  const rows = useQuery(
    listPaymentCustomersRef,
    isAuthenticated ? { limit: 100, search: debouncedSearch || undefined } : "skip",
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirectTo=/dashboard/operator");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!rows) return;
    console.info(
      `[dashboard/operator] payment customer rows updated count=${rows.length} search=${debouncedSearch || "none"}`,
    );
  }, [rows, debouncedSearch]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <section className="w-full max-w-6xl rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Operator</h1>
          <p className="mt-2 text-sm text-zinc-600">Checking session...</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <section className="mx-auto w-full max-w-6xl rounded-xl bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Operator: Payment Customers</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Live view of Sell customer/subscription linkage in Convex.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 underline">
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="flex min-w-72 flex-col gap-1 text-xs font-medium text-zinc-700">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="email, customer id, subscription id, event id..."
              className="h-9 rounded-md border border-zinc-300 px-3 text-sm text-zinc-900"
            />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Subscription</th>
                <th className="px-3 py-2">Customer ID</th>
                <th className="px-3 py-2">Subscription ID</th>
                <th className="px-3 py-2">Last Event</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {!rows && (
                <tr>
                  <td className="px-3 py-4 text-zinc-600" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              )}
              {rows?.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-zinc-600" colSpan={6}>
                    No payment customer mappings found.
                  </td>
                </tr>
              )}
              {rows?.map((row) => (
                <tr key={`${row.provider}:${row.userId}:${row.externalSubscriptionId ?? "none"}`}>
                  <td className="px-3 py-3 align-top">
                    <p className="font-medium text-zinc-900">{row.userEmail ?? row.userId}</p>
                    <p className="mt-1 font-mono text-xs text-zinc-500">{row.userId}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      customer email: {row.customerEmail ?? "n/a"}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top text-zinc-700">
                    {row.subscriptionStatus ?? "none"}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs text-zinc-700">
                    {row.externalCustomerId ?? "n/a"}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs text-zinc-700">
                    {row.externalSubscriptionId ?? "n/a"}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs text-zinc-700">
                    {row.lastEventId ?? "n/a"}
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-zinc-700">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

