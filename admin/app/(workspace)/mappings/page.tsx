"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
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

export default function MappingsPage() {
  const listConnectors = useMemo(
    () => makeFunctionReference<"query", {}, ConnectorRow[]>("connectors:listConnectors"),
    [],
  );
  const rotateConnectorToken = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string },
        { token: string }
      >("connectors:rotateConnectorToken"),
    [],
  );

  const connectors = useQuery(listConnectors);
  const doRotate = useMutation(rotateConnectorToken);

  const [tenantKey, setTenantKey] = useState("t1");
  const [connectorId, setConnectorId] = useState("conn_01");
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  async function onCreateOrRotate() {
    setIsRotating(true);
    setLastToken(null);
    try {
      const res = await doRotate({ tenantKey, connectorId });
      setLastToken(res.token);
      console.info(
        `[admin/mappings] connector token rotated tenant=${tenantKey} connector=${connectorId}`,
      );
    } finally {
      setIsRotating(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Mappings"
        title="Connector Mappings"
        description="Create connector tokens and manage routing surfaces for Discord mirroring."
        breadcrumbs={buildAdminBreadcrumbs("/mappings")}
        actions={
          <>
            <Link href="/shop/policies" className="admin-link">
              Shop policies
            </Link>
            <Link href="/shop/customers" className="admin-link">
              Shop customers
            </Link>
            <Link href="/discord-bot" className="admin-link">
              Discord Bot
            </Link>
          </>
        }
      />

      <AdminSectionCard title="Create or rotate token">
        <div className="flex flex-wrap items-end gap-3">
          <label className="admin-label">
            Tenant
            <input
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
              className="admin-input w-40"
            />
          </label>
          <label className="admin-label">
            Connector ID
            <input
              value={connectorId}
              onChange={(e) => setConnectorId(e.target.value)}
              className="admin-input w-56"
            />
          </label>
          <button
            type="button"
            onClick={onCreateOrRotate}
            disabled={isRotating}
            className="admin-btn-secondary"
          >
            {isRotating ? "Working..." : "Create/Rotate"}
          </button>
        </div>

        {lastToken ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-700">Connector token (shown once):</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
              {lastToken}
            </pre>
          </div>
        ) : null}
      </AdminSectionCard>

      <AdminTableShell
        title="Existing Connectors"
        isLoading={!connectors}
        isEmpty={connectors !== undefined && connectors.length === 0}
        emptyMessage="No connectors yet."
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold text-zinc-700">
            <tr>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Connector</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Mirroring</th>
              <th className="px-3 py-2">Config</th>
              <th className="px-3 py-2">Last Seen</th>
              <th className="px-3 py-2">Open</th>
            </tr>
          </thead>
          <tbody>
            {connectors?.map((connector) => (
              <tr key={connector._id} className="border-t border-zinc-200">
                <td className="px-3 py-2">{connector.tenantKey}</td>
                <td className="px-3 py-2">{connector.connectorId}</td>
                <td className="px-3 py-2">{connector.status}</td>
                <td className="px-3 py-2">
                  {connector.forwardEnabled === true ? "enabled" : "disabled"}
                </td>
                <td className="px-3 py-2">v{connector.configVersion}</td>
                <td className="px-3 py-2">
                  {connector.lastSeenAt ? new Date(connector.lastSeenAt).toLocaleString() : "never"}
                </td>
                <td className="px-3 py-2">
                  <Link
                    className="font-medium underline"
                    href={`/mappings/${encodeURIComponent(connector.tenantKey)}/${encodeURIComponent(
                      connector.connectorId,
                    )}`}
                  >
                    Configure
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
