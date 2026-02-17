"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type PolicyScope = "product" | "variant";
type Tier = "basic" | "advanced" | "pro";

type PolicyRow = {
  scope: PolicyScope;
  externalId: string;
  tier: Tier;
  durationDays: number | null;
  enabled: boolean;
  updatedAt: number;
};

export default function ShopPoliciesPage() {
  const listRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, PolicyRow[]>(
        "sellAccessPolicies:listSellAccessPolicies",
      ),
    [],
  );
  const upsertRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          scope: PolicyScope;
          externalId: string;
          tier: Tier;
          durationDays: number;
          enabled: boolean;
        },
        { ok: true }
      >("sellAccessPolicies:upsertSellAccessPolicy"),
    [],
  );
  const removeRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { scope: PolicyScope; externalId: string },
        { ok: true; removed: boolean }
      >("sellAccessPolicies:removeSellAccessPolicy"),
    [],
  );

  const rows = useQuery(listRef, {});
  const upsertPolicy = useMutation(upsertRef);
  const removePolicy = useMutation(removeRef);

  const [scope, setScope] = useState<PolicyScope>("variant");
  const [externalId, setExternalId] = useState("");
  const [tier, setTier] = useState<Tier>("basic");
  const [durationDays, setDurationDays] = useState("30");
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const duration = Number.parseInt(durationDays.trim(), 10);
      if (!Number.isInteger(duration) || duration <= 0) {
        throw new Error("Duration days must be a positive integer.");
      }
      await upsertPolicy({
        scope,
        externalId,
        tier,
        durationDays: duration,
        enabled,
      });
      setMessage("Policy saved.");
      console.info(
        `[admin/shop] policy saved scope=${scope} id=${externalId} tier=${tier} duration_days=${duration} enabled=${enabled}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save policy";
      setError(text);
      console.error(`[admin/shop] policy save failed: ${text}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function onRemove(row: PolicyRow) {
    setMessage(null);
    setError(null);
    try {
      await removePolicy({ scope: row.scope, externalId: row.externalId });
      setMessage(`Removed ${row.scope}:${row.externalId}`);
      console.info(`[admin/shop] policy removed scope=${row.scope} id=${row.externalId}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to remove policy";
      setError(text);
      console.error(`[admin/shop] policy remove failed: ${text}`);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Shop"
        title="Access Policies"
        description="Map Sell products and variants to fixed-term tiers for entitlement enforcement."
        breadcrumbs={buildAdminBreadcrumbs("/shop/policies")}
        actions={
          <>
            <Link href="/shop/catalog" className="admin-link">
              Catalog
            </Link>
            <Link href="/shop/customers" className="admin-link">
              Customers
            </Link>
            <Link href="/mappings" className="admin-link">
              Mappings
            </Link>
          </>
        }
      />

      <AdminSectionCard title="Create / update policy">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="admin-label">
            Scope
            <select className="admin-input" value={scope} onChange={(e) => setScope(e.target.value as PolicyScope)}>
              <option value="variant">variant</option>
              <option value="product">product</option>
            </select>
          </label>

          <label className="admin-label">
            External ID
            <input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              className="admin-input"
              placeholder={scope === "variant" ? "sell variant id" : "sell product id or productId|slug"}
            />
          </label>

          <label className="admin-label">
            Tier
            <select className="admin-input" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
              <option value="basic">basic</option>
              <option value="advanced">advanced</option>
              <option value="pro">pro</option>
            </select>
          </label>

          <label className="admin-label">
            Duration days
            <input
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="admin-input"
              placeholder="30"
            />
          </label>

          <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void onSave()} disabled={isSaving} className="admin-btn-primary">
            {isSaving ? "Saving..." : "Save policy"}
          </button>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        {scope === "product" ? (
          <p className="mt-3 text-xs text-slate-600">
            For auto checkout URLs, you can use <code>productId|slug</code> (for example{" "}
            <code>349820|basic-plan</code>).
          </p>
        ) : null}
      </AdminSectionCard>

      <AdminTableShell
        title="Configured Policies"
        isLoading={!rows}
        isEmpty={rows !== undefined && rows.length === 0}
        emptyMessage="No policies configured."
      >
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">External ID</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Enabled</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows?.map((row) => (
              <tr key={`${row.scope}:${row.externalId}`}>
                <td className="px-3 py-3">{row.scope}</td>
                <td className="px-3 py-3 font-mono text-xs">{row.externalId}</td>
                <td className="px-3 py-3">{row.tier}</td>
                <td className="px-3 py-3">{row.durationDays ?? "n/a"}</td>
                <td className="px-3 py-3">{row.enabled ? "yes" : "no"}</td>
                <td className="px-3 py-3 text-xs">{new Date(row.updatedAt).toLocaleString()}</td>
                <td className="px-3 py-3">
                  <button type="button" onClick={() => void onRemove(row)} className="text-sm font-semibold underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
