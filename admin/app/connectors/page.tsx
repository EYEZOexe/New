"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

type ConnectorRow = {
  _id: string;
  tenantKey: string;
  connectorId: string;
  status: "active" | "paused";
  configVersion: number;
  updatedAt: number;
  lastSeenAt: number;
};

export default function ConnectorsPage() {
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
    } finally {
      setIsRotating(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <section className="mx-auto w-full max-w-5xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Connectors</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Create a connector token and manage runtime config.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-zinc-900 underline">
              Home
            </Link>
            <Link
              href="/payments/customers"
              className="text-sm font-medium text-zinc-900 underline"
            >
              Payment customers
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Create or rotate token
          </h2>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Tenant
              <input
                value={tenantKey}
                onChange={(e) => setTenantKey(e.target.value)}
                className="h-9 w-40 rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Connector ID
              <input
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
                className="h-9 w-56 rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={onCreateOrRotate}
              disabled={isRotating}
              className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
            >
              {isRotating ? "Working..." : "Create/Rotate"}
            </button>
          </div>

          {lastToken ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-700">
                Connector token (shown once):
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
                {lastToken}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900">Existing</h2>

          {!connectors ? (
            <p className="mt-3 text-sm text-zinc-600">Loading...</p>
          ) : connectors.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">No connectors yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-700">
                  <tr>
                    <th className="px-3 py-2">Tenant</th>
                    <th className="px-3 py-2">Connector</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Config</th>
                    <th className="px-3 py-2">Last Seen</th>
                    <th className="px-3 py-2">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {connectors.map((c) => (
                    <tr key={c._id} className="border-t border-zinc-200">
                      <td className="px-3 py-2">{c.tenantKey}</td>
                      <td className="px-3 py-2">{c.connectorId}</td>
                      <td className="px-3 py-2">{c.status}</td>
                      <td className="px-3 py-2">v{c.configVersion}</td>
                      <td className="px-3 py-2">
                        {c.lastSeenAt
                          ? new Date(c.lastSeenAt).toLocaleString()
                          : "never"}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          className="font-medium underline"
                          href={`/connectors/${encodeURIComponent(
                            c.tenantKey,
                          )}/${encodeURIComponent(c.connectorId)}`}
                        >
                          Configure
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

