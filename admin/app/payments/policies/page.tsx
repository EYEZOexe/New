"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";

type PolicyScope = "product" | "variant";
type Tier = "basic" | "advanced" | "pro";
type BillingMode = "recurring" | "fixed_term";

type PolicyRow = {
  scope: PolicyScope;
  externalId: string;
  tier: Tier;
  billingMode: BillingMode;
  durationDays: number | null;
  enabled: boolean;
  updatedAt: number;
};

export default function PaymentPoliciesPage() {
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
          billingMode: BillingMode;
          durationDays?: number;
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
  const [billingMode, setBillingMode] = useState<BillingMode>("fixed_term");
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
      const duration =
        billingMode === "fixed_term"
          ? Number.parseInt(durationDays.trim(), 10)
          : undefined;
      await upsertPolicy({
        scope,
        externalId,
        tier,
        billingMode,
        durationDays: Number.isFinite(duration) ? duration : undefined,
        enabled,
      });
      setMessage("Policy saved.");
      console.info(
        `[admin/payment-policies] saved scope=${scope} id=${externalId} tier=${tier} billing=${billingMode} enabled=${enabled}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save policy";
      setError(text);
      console.error(`[admin/payment-policies] save failed: ${text}`);
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
      console.info(
        `[admin/payment-policies] removed scope=${row.scope} id=${row.externalId}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to remove policy";
      setError(text);
      console.error(`[admin/payment-policies] remove failed: ${text}`);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <section className="mx-auto w-full max-w-6xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sell Access Policies</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Map Sell product/variant IDs to tier and billing behavior.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium underline">
              Home
            </Link>
            <Link href="/payments/customers" className="text-sm font-medium underline">
              Payment customers
            </Link>
            <Link href="/discord" className="text-sm font-medium underline">
              Discord roles
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Create / update policy</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Scope
              <select
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value as PolicyScope)}
              >
                <option value="variant">variant</option>
                <option value="product">product</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              External ID
              <input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                className="h-9 rounded-md border border-zinc-300 px-3 text-sm"
                placeholder={scope === "variant" ? "sell variant id" : "sell product id"}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Tier
              <select
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                value={tier}
                onChange={(e) => setTier(e.target.value as Tier)}
              >
                <option value="basic">basic</option>
                <option value="advanced">advanced</option>
                <option value="pro">pro</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Billing mode
              <select
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value as BillingMode)}
              >
                <option value="fixed_term">fixed_term</option>
                <option value="recurring">recurring</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Duration days (fixed_term)
              <input
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                disabled={billingMode !== "fixed_term"}
                className="h-9 rounded-md border border-zinc-300 px-3 text-sm disabled:opacity-60"
                placeholder="30"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled
            </label>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={isSaving}
              className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save policy"}
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">External ID</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Billing</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {!rows && (
                <tr>
                  <td className="px-3 py-4 text-zinc-600" colSpan={8}>
                    Loading...
                  </td>
                </tr>
              )}
              {rows?.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-zinc-600" colSpan={8}>
                    No policies configured.
                  </td>
                </tr>
              )}
              {rows?.map((row) => (
                <tr key={`${row.scope}:${row.externalId}`}>
                  <td className="px-3 py-3">{row.scope}</td>
                  <td className="px-3 py-3 font-mono text-xs">{row.externalId}</td>
                  <td className="px-3 py-3">{row.tier}</td>
                  <td className="px-3 py-3">{row.billingMode}</td>
                  <td className="px-3 py-3">{row.durationDays ?? "n/a"}</td>
                  <td className="px-3 py-3">{row.enabled ? "yes" : "no"}</td>
                  <td className="px-3 py-3 text-xs">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void onRemove(row)}
                      className="text-sm font-medium underline"
                    >
                      Remove
                    </button>
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
