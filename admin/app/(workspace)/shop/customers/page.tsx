"use client";

import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type OperatorPaymentRow = {
  provider: string;
  userId: string;
  userEmail: string | null;
  tier: "basic" | "advanced" | "pro" | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  endsAt: number | null;
  customerEmail: string | null;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  lastEventId: string | null;
  updatedAt: number;
};

export default function ShopCustomersPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useMemo(() => search.trim(), [search]);

  const listPaymentCustomersRef = makeFunctionReference<
    "query",
    { limit?: number; search?: string },
    OperatorPaymentRow[]
  >("payments:listPaymentCustomers");

  const rows = useQuery(listPaymentCustomersRef, {
    limit: 200,
    search: debouncedSearch || undefined,
  });

  useEffect(() => {
    if (!rows) return;
    console.info(
      `[admin/shop] customers rows updated count=${rows.length} search=${debouncedSearch || "none"}`,
    );
  }, [rows, debouncedSearch]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Shop"
        title="Customers"
        description="Sell customer and subscription linkage for support and reconciliation."
        breadcrumbs={buildAdminBreadcrumbs("/shop/customers")}
        actions={
          <>
            <Link href="/shop/catalog" className="admin-link">
              Catalog
            </Link>
            <Link href="/shop/policies" className="admin-link">
              Policies
            </Link>
            <Link href="/discord-bot" className="admin-link">
              Discord Bot
            </Link>
          </>
        }
      />

      <div>
        <label className="admin-label max-w-md">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="email, customer id, subscription id, event id..."
            className="admin-input"
          />
        </label>
      </div>

      <AdminTableShell
        title="Customer Records"
        isLoading={!rows}
        isEmpty={rows !== undefined && rows.length === 0}
        emptyMessage="No payment customer mappings found."
        tableClassName="max-h-[34rem] overflow-auto"
      >
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="sticky top-0 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Subscription</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Ends</th>
              <th className="px-3 py-2">Customer ID</th>
              <th className="px-3 py-2">Subscription ID</th>
              <th className="px-3 py-2">Last Event</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {rows?.map((row) => (
              <tr key={`${row.provider}:${row.userId}:${row.externalSubscriptionId ?? "none"}`}>
                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-slate-100">{row.userEmail ?? row.userId}</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{row.userId}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    customer email: {row.customerEmail ?? "n/a"}
                  </p>
                </td>
                <td className="px-3 py-3 align-top text-slate-300">{row.subscriptionStatus ?? "none"}</td>
                <td className="px-3 py-3 align-top text-slate-300">{row.tier ?? "n/a"}</td>
                <td className="px-3 py-3 align-top text-xs text-slate-300">
                  {row.endsAt ? new Date(row.endsAt).toLocaleString() : "n/a"}
                </td>
                <td className="px-3 py-3 align-top font-mono text-xs text-slate-300">
                  {row.externalCustomerId ?? "n/a"}
                </td>
                <td className="px-3 py-3 align-top font-mono text-xs text-slate-300">
                  {row.externalSubscriptionId ?? "n/a"}
                </td>
                <td className="px-3 py-3 align-top font-mono text-xs text-slate-300">
                  {row.lastEventId ?? "n/a"}
                </td>
                <td className="px-3 py-3 align-top text-xs text-slate-300">
                  {new Date(row.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
