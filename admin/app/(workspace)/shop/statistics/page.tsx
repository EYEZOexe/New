"use client";

import { makeFunctionReference } from "convex/server";
import { useAction } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type SellStatsOverview = {
  generatedAt: number;
  periodDays: number;
  periodStart: number;
  pagesFetched: number;
  invoicesScanned: number;
  summary: {
    completedSales: number;
    estimatedRevenueCents: number;
    averageOrderValueCents: number;
    renewalPurchases: number;
    firstTimePurchases: number;
    renewalRatePercent: number;
    uniqueCustomers: number;
    pendingInvoices: number;
    refundedOrCanceledInvoices: number;
    latestCompletedAt: number | null;
    currency: string | null;
  };
  topProducts: {
    productKey: string;
    title: string;
    completedSales: number;
    estimatedRevenueCents: number;
  }[];
};

function formatMoney(cents: number, currency: string | null): string {
  const value = cents / 100;
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function formatDateTime(value: number | null): string {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

export default function ShopStatisticsPage() {
  const getSellStatsOverviewRef = useMemo(
    () =>
      makeFunctionReference<
        "action",
        { periodDays?: number; maxPages?: number },
        SellStatsOverview
      >("sellStats:getSellStatsOverview"),
    [],
  );
  const getSellStatsOverview = useAction(getSellStatsOverviewRef);
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
  const [stats, setStats] = useState<SellStatsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSellStatsOverview({
        periodDays,
        maxPages: periodDays === 90 ? 12 : 6,
      });
      setStats(result);
      console.info(
        `[admin/shop-stats] loaded period_days=${result.periodDays} completed=${result.summary.completedSales} revenue_cents=${result.summary.estimatedRevenueCents} renewals=${result.summary.renewalPurchases} invoices_scanned=${result.invoicesScanned}`,
      );
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load Sell statistics";
      setError(message);
      console.error(`[admin/shop-stats] load failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [getSellStatsOverview, periodDays]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const summary = stats?.summary ?? null;
  const currency = summary?.currency ?? "USD";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Shop"
        title="Statistics"
        description="Sell.app revenue and renewal metrics tuned for manual renewal flows."
        breadcrumbs={buildAdminBreadcrumbs("/shop/statistics")}
        actions={
          <>
            <Link href="/shop/catalog" className="admin-link">
              Catalog
            </Link>
            <Link href="/shop/policies" className="admin-link">
              Policies
            </Link>
            <Link href="/shop/customers" className="admin-link">
              Customers
            </Link>
          </>
        }
      />

      <AdminSectionCard
        title="Filters"
        description="Metrics are computed from Sell invoices, not recurring subscription objects."
        actions={
          <button
            type="button"
            onClick={() => void loadStats()}
            className="admin-btn-secondary"
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriodDays(value as 7 | 30 | 90)}
              className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition ${
                periodDays === value
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              Last {value} days
            </button>
          ))}
        </div>
        {stats ? (
          <p className="mt-3 text-xs text-slate-400">
            Window: {new Date(stats.periodStart).toLocaleString()} {"->"}{" "}
            {new Date(stats.generatedAt).toLocaleString()} | pages fetched: {stats.pagesFetched} |
            invoices scanned: {stats.invoicesScanned}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </AdminSectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">Completed sales</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{summary?.completedSales ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">Paid/completed invoices in selected window.</p>
        </div>
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">Estimated revenue</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {formatMoney(summary?.estimatedRevenueCents ?? 0, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Manual renewals counted per completed invoice.</p>
        </div>
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">Renewals</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {summary?.renewalPurchases ?? 0} ({summary?.renewalRatePercent ?? 0}%)
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Repeat purchases by customers seen before in this window.
          </p>
        </div>
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">AOV</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {formatMoney(summary?.averageOrderValueCents ?? 0, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Average order value for completed sales.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">Unique customers</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{summary?.uniqueCustomers ?? 0}</p>
        </div>
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">First-time purchases</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{summary?.firstTimePurchases ?? 0}</p>
        </div>
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pending invoices</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{summary?.pendingInvoices ?? 0}</p>
        </div>
        <div className="admin-surface-soft">
          <p className="text-xs uppercase tracking-wide text-slate-400">Refunded/canceled</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">
            {summary?.refundedOrCanceledInvoices ?? 0}
          </p>
        </div>
      </div>

      <AdminSectionCard title="Important Information">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-300">
            Latest completed sale:{" "}
            <span className="font-semibold text-slate-100">
              {formatDateTime(summary?.latestCompletedAt ?? null)}
            </span>
          </p>
          <p className="text-sm text-slate-300">
            Model note: renewal stats are invoice-based because access is manual fixed-term renewals.
          </p>
        </div>
      </AdminSectionCard>

      <AdminTableShell title="Top Products (by revenue)">
        <table className="admin-table min-w-full">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Completed sales</th>
              <th className="px-3 py-2 text-left">Estimated revenue</th>
            </tr>
          </thead>
          <tbody>
            {(stats?.topProducts ?? []).length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400" colSpan={3}>
                  {isLoading ? "Loading..." : "No completed product sales found for this window."}
                </td>
              </tr>
            ) : (
              (stats?.topProducts ?? []).map((row) => (
                <tr key={row.productKey}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-100">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.productKey}</p>
                  </td>
                  <td className="px-3 py-3">{row.completedSales}</td>
                  <td className="px-3 py-3">
                    {formatMoney(row.estimatedRevenueCents, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
