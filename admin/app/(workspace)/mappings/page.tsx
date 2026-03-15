"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import { ConnectorTokenSheet } from "@/components/admin/connector-token-sheet";
import { useConnectorStats } from "@/context/connector-stats-context";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type ConnectorRow = {
  _id: string;
  tenantKey: string;
  connectorId: string;
  status: "active" | "paused";
  forwardEnabled?: boolean;
  configVersion: number;
  updatedAt: number;
  lastSeenAt: number;
};

const listConnectorsRef = makeFunctionReference<"query", Record<string, never>, ConnectorRow[]>(
  "connectors:listConnectors",
);

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function HealthDot({ failedJobs, status }: { failedJobs: number; status: "active" | "paused" }) {
  if (failedJobs > 0) {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-red-500"
        title="Failed jobs"
        aria-label="failed"
      />
    );
  }
  if (status !== "active") {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-amber-500"
        title="Not active"
        aria-label="paused"
      />
    );
  }
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-emerald-500"
      title="Healthy"
      aria-label="active"
    />
  );
}

export default function MappingsPage() {
  const connectors = useQuery(listConnectorsRef, {});
  const { failedJobsByConnector } = useConnectorStats();
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);

  const breadcrumbs = useMemo(() => buildAdminBreadcrumbs("/mappings"), []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Mappings"
        title="Connectors"
        description="Manage connector routing surfaces for Discord mirroring."
        breadcrumbs={breadcrumbs}
        actions={
          <>
            <button
              type="button"
              onClick={() => setTokenSheetOpen(true)}
              className="admin-btn-secondary"
            >
              Create / Rotate Token
            </button>
            <Link href="/shop/policies" className="admin-link">
              Shop policies
            </Link>
            <Link href="/shop/customers" className="admin-link">
              Shop customers
            </Link>
            <Link href="/discord-bot" className="admin-link">
              Discord Bot
            </Link>
            <Link href="/filtering" className="admin-link">
              Filtering
            </Link>
          </>
        }
      />

      <AdminTableShell
        title="Connectors"
        isLoading={!connectors}
        isEmpty={connectors !== undefined && connectors.length === 0}
        emptyMessage="No connectors yet."
      >
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-900 text-xs font-semibold text-slate-300">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Connector</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Mirroring</th>
              <th className="px-3 py-2">Failed jobs</th>
              <th className="px-3 py-2">Last seen</th>
              <th className="px-3 py-2">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
            {connectors?.map((connector) => {
              const key = `${connector.tenantKey}::${connector.connectorId}`;
              const failedJobs = failedJobsByConnector[key] ?? 0;
              const openHref =
                failedJobs > 0
                  ? `/mappings/${encodeURIComponent(connector.tenantKey)}/${encodeURIComponent(connector.connectorId)}?tab=jobs`
                  : `/mappings/${encodeURIComponent(connector.tenantKey)}/${encodeURIComponent(connector.connectorId)}?tab=overview`;
              return (
                <tr key={connector._id}>
                  <td className="px-3 py-2">
                    <HealthDot failedJobs={failedJobs} status={connector.status} />
                  </td>
                  <td className="px-3 py-2">{connector.tenantKey}</td>
                  <td className="px-3 py-2">{connector.connectorId}</td>
                  <td className="px-3 py-2">{connector.status}</td>
                  <td className="px-3 py-2">
                    {connector.forwardEnabled === true ? "enabled" : "disabled"}
                  </td>
                  <td className="px-3 py-2">
                    {failedJobs > 0 ? (
                      <span className="rounded-full border border-red-400/30 bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
                        {failedJobs}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {connector.lastSeenAt ? relativeTime(connector.lastSeenAt) : "never"}
                  </td>
                  <td className="px-3 py-2">
                    <Link className="font-medium text-indigo-300 underline" href={openHref}>
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminTableShell>

      <ConnectorTokenSheet open={tokenSheetOpen} onOpenChange={setTokenSheetOpen} />
    </div>
  );
}
