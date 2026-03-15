"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import { ConnectorTokenSheet } from "@/components/admin/connector-token-sheet";
import { useConnectorStats } from "@/context/connector-stats-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectorDoc = {
  _id: string;
  tenantKey: string;
  connectorId: string;
  status: "active" | "paused";
  forwardEnabled?: boolean;
  updatedAt: number;
  lastSeenAt: number;
};

type RecentJob = {
  _id: string;
  updatedAt: number;
  eventType: "create" | "update" | "delete";
  tenantKey: string;
  connectorId: string;
  sourceChannelId: string;
  targetChannelId: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
};

type MergedConnector = ConnectorDoc & {
  failedJobs: number;
  pendingJobs: number;
};

// ---------------------------------------------------------------------------
// Module-level query references (stable — no per-render recreation)
// ---------------------------------------------------------------------------

const listConnectorsRef = makeFunctionReference<
  "query",
  Record<string, never>,
  ConnectorDoc[]
>("connectors:listConnectors");

const listRecentJobsRef = makeFunctionReference<
  "query",
  { limit: number },
  RecentJob[]
>("connectors:listRecentJobsGlobal");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectorHealthRow({ row }: { row: MergedConnector }) {
  const dotColour =
    row.failedJobs > 0
      ? "bg-red-500"
      : row.status !== "active"
        ? "bg-amber-500"
        : "bg-green-500";

  const openHref =
    row.failedJobs > 0
      ? `/mappings/${row.tenantKey}/${row.connectorId}?tab=jobs`
      : `/mappings/${row.tenantKey}/${row.connectorId}?tab=overview`;

  return (
    <tr className="border-b border-slate-800/60 hover:bg-slate-800/30">
      <td className="px-4 py-3">
        <span className={`inline-block size-2 rounded-full ${dotColour}`} />
      </td>
      <td className="px-4 py-3 text-slate-300">{row.tenantKey}</td>
      <td className="px-4 py-3 text-slate-300">{row.connectorId}</td>
      <td className="px-4 py-3 text-slate-400">{row.status}</td>
      <td className="px-4 py-3 text-slate-400">
        {row.forwardEnabled ? "enabled" : "disabled"}
      </td>
      <td className="px-4 py-3">
        {row.failedJobs > 0 ? (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
            {row.failedJobs}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-slate-400">{relativeTime(row.lastSeenAt)}</td>
      <td className="px-4 py-3 text-right">
        <Link href={openHref} className="admin-link">
          Open →
        </Link>
      </td>
    </tr>
  );
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-500/20 text-green-400";
    case "failed":
      return "bg-red-500/20 text-red-400";
    case "processing":
      return "bg-amber-500/20 text-amber-400";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
}

function RecentJobRow({ job }: { job: RecentJob }) {
  return (
    <tr className="border-b border-slate-800/60 hover:bg-slate-800/30">
      <td className="px-4 py-3 text-slate-400">{relativeTime(job.updatedAt)}</td>
      <td className="px-4 py-3 text-slate-300">{capitalize(job.eventType)}</td>
      <td className="px-4 py-3 text-slate-400">
        {job.tenantKey} / {job.connectorId}
      </td>
      <td className="px-4 py-3 text-slate-400">
        {job.sourceChannelId} → {job.targetChannelId}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(job.status)}`}
        >
          {job.status}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-400">{job.attempts}</td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/mappings/${job.tenantKey}/${job.connectorId}?tab=jobs`}
          className="admin-link"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { connectorHealth } = useConnectorStats();
  const connectorsRaw = useQuery(listConnectorsRef, {});
  const recentJobs = useQuery(listRecentJobsRef, { limit: 10 });
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);

  // Derived stat values
  const totalConnectors = connectorsRaw?.length ?? 0;
  const activeConnectors = connectorsRaw?.filter((c) => c.status === "active").length ?? 0;
  const totalFailed = connectorHealth.reduce((sum, h) => sum + h.failedJobs, 0);
  const totalPending = connectorHealth.reduce((sum, h) => sum + h.pendingJobs, 0);
  const firstFailingConnector = connectorHealth.find((h) => h.failedJobs > 0);

  // Merged connector list (connectorsRaw joined with health data)
  const mergedConnectors = useMemo<MergedConnector[]>(() => {
    if (!connectorsRaw) return [];
    return connectorsRaw.map((c) => {
      const health = connectorHealth.find(
        (h) => h.tenantKey === c.tenantKey && h.connectorId === c.connectorId,
      );
      return {
        ...c,
        failedJobs: health?.failedJobs ?? 0,
        pendingJobs: health?.pendingJobs ?? 0,
      };
    });
  }, [connectorsRaw, connectorHealth]);

  // Failed jobs card: only linkable when there is a failing connector
  const failedJobsCard = (
    <div className="admin-section-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
        Failed Jobs
      </p>
      <p
        className={`mt-2 text-2xl font-bold ${totalFailed > 0 ? "text-red-400" : "text-slate-100"}`}
      >
        {totalFailed}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Dashboard"
        title="Control Plane"
        description="Overview of connectors, jobs, and shop activity."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Active Connectors */}
        <Link href="/mappings" className="block">
          <div className="admin-section-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
              Active Connectors
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-100">
              {activeConnectors} / {totalConnectors}
            </p>
          </div>
        </Link>

        {/* Failed Jobs */}
        {totalFailed > 0 && firstFailingConnector ? (
          <Link
            href={`/mappings/${firstFailingConnector.tenantKey}/${firstFailingConnector.connectorId}?tab=jobs`}
            className="block"
          >
            {failedJobsCard}
          </Link>
        ) : (
          failedJobsCard
        )}

        {/* Pending Jobs */}
        <div className="admin-section-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Pending Jobs
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{totalPending}</p>
        </div>

        {/* TODO: route count requires a separate query not yet implemented */}
        {/* Total Routes */}
        <div className="admin-section-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Total Routes
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-100">—</p>
        </div>
      </div>

      {/* Connector Health Table */}
      <AdminTableShell
        title="Connector Health"
        isLoading={connectorsRaw === undefined}
        isEmpty={mergedConnectors.length === 0}
        emptyMessage="No connectors found."
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-white/40">
              <th className="w-8 px-4 py-3"></th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Connector</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Mirroring</th>
              <th className="px-4 py-3">Failed</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {mergedConnectors.map((row) => (
              <ConnectorHealthRow key={`${row.tenantKey}::${row.connectorId}`} row={row} />
            ))}
          </tbody>
        </table>
      </AdminTableShell>

      {/* Quick Links */}
      <AdminSectionCard title="Quick links">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTokenSheetOpen(true)}
            className="admin-btn-secondary"
          >
            Create / rotate token
          </button>
          <Link href="/shop/customers" className="admin-btn-secondary">
            Manage customers
          </Link>
          <Link href="/shop/statistics" className="admin-btn-secondary">
            View statistics
          </Link>
        </div>
      </AdminSectionCard>

      {/* Recent Activity */}
      <AdminTableShell
        title="Recent Activity"
        isLoading={recentJobs === undefined}
        isEmpty={(recentJobs?.length ?? 0) === 0}
        emptyMessage="No recent activity."
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-white/40">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Connector</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {recentJobs?.map((job) => (
              <RecentJobRow key={job._id} job={job} />
            ))}
          </tbody>
        </table>
      </AdminTableShell>

      {/* Token sheet */}
      <ConnectorTokenSheet open={tokenSheetOpen} onOpenChange={setTokenSheetOpen} />
    </div>
  );
}
