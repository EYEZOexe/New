"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type SubscriptionTier = "basic" | "advanced" | "pro";
type SubscriptionStatus = "active" | "inactive" | "canceled" | "past_due";
type OperatorError = {
  code: string;
  message: string;
};
type OperatorResult<T extends Record<string, unknown>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: OperatorError;
    };

type OperatorPaymentRow = {
  provider: string;
  userId: string;
  userEmail: string | null;
  tier: SubscriptionTier | null;
  subscriptionStatus: SubscriptionStatus | null;
  endsAt: number | null;
  customerEmail: string | null;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  lastEventId: string | null;
  updatedAt: number;
};

function formatDateTime(value: number | null): string {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

function CustomerActionsPanel({
  row,
  onUpdateEmail,
  onSetPassword,
  onSetSubscription,
}: {
  row: OperatorPaymentRow;
  onUpdateEmail: (args: { userId: string; email: string }) => Promise<
    OperatorResult<{
      userId: string;
      email: string;
    }>
  >;
  onSetPassword: (args: {
    userId: string;
    password: string;
    invalidateExistingSessions?: boolean;
  }) => Promise<
    OperatorResult<{
      userId: string;
      sessionsInvalidated: boolean;
    }>
  >;
  onSetSubscription: (args: {
    userId: string;
    action: "grant" | "revoke";
    tier?: SubscriptionTier;
    durationDays?: number;
  }) => Promise<
    OperatorResult<{
      userId: string;
      subscriptionStatus: SubscriptionStatus;
      tier: SubscriptionTier | null;
      endsAt: number | null;
      roleSyncQueued: number;
    }>
  >;
}) {
  const [emailDraft, setEmailDraft] = useState(row.userEmail ?? row.customerEmail ?? "");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [tierDraft, setTierDraft] = useState<SubscriptionTier>(row.tier ?? "basic");
  const [durationDaysDraft, setDurationDaysDraft] = useState("14");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    setEmailDraft(row.userEmail ?? row.customerEmail ?? "");
    setTierDraft(row.tier ?? "basic");
  }, [row.userEmail, row.customerEmail, row.tier, row.userId]);

  async function onSaveEmail() {
    setIsSavingEmail(true);
    setMessage(null);
    setError(null);
    try {
      const result = await onUpdateEmail({
        userId: row.userId,
        email: emailDraft,
      });
      if (!result.ok) {
        setError(result.error.message);
        console.error(
          `[admin/shop] customer email update failed user=${row.userId} code=${result.error.code} message=${result.error.message}`,
        );
        return;
      }
      setMessage(`Email updated to ${result.email}.`);
      console.info(
        `[admin/shop] customer email updated user=${row.userId} email=${result.email}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to update email";
      setError(text);
      console.error(`[admin/shop] customer email update failed user=${row.userId}: ${text}`);
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function onSavePassword() {
    setIsSavingPassword(true);
    setMessage(null);
    setError(null);
    try {
      const result = await onSetPassword({
        userId: row.userId,
        password: passwordDraft,
        invalidateExistingSessions: true,
      });
      if (!result.ok) {
        setError(result.error.message);
        console.error(
          `[admin/shop] customer password reset failed user=${row.userId} code=${result.error.code} message=${result.error.message}`,
        );
        return;
      }
      setPasswordDraft("");
      setMessage(
        `Password reset complete. Sessions invalidated: ${result.sessionsInvalidated ? "yes" : "no"}.`,
      );
      console.info(
        `[admin/shop] customer password reset user=${row.userId} sessions_invalidated=${result.sessionsInvalidated}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to reset password";
      setError(text);
      console.error(`[admin/shop] customer password reset failed user=${row.userId}: ${text}`);
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function onGrantSubscription() {
    setIsGranting(true);
    setMessage(null);
    setError(null);
    try {
      const parsedDuration = Number.parseInt(durationDaysDraft.trim(), 10);
      if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
        throw new Error("Duration days must be a positive integer.");
      }
      const result = await onSetSubscription({
        userId: row.userId,
        action: "grant",
        tier: tierDraft,
        durationDays: parsedDuration,
      });
      if (!result.ok) {
        setError(result.error.message);
        console.error(
          `[admin/shop] customer grant failed user=${row.userId} code=${result.error.code} message=${result.error.message}`,
        );
        return;
      }
      setMessage(
        `Access granted (${result.tier ?? "none"}) until ${formatDateTime(result.endsAt)}. Role sync jobs: ${result.roleSyncQueued}.`,
      );
      console.info(
        `[admin/shop] customer access granted user=${row.userId} tier=${result.tier ?? "none"} ends_at=${result.endsAt ?? 0} role_sync_jobs=${result.roleSyncQueued}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to grant subscription";
      setError(text);
      console.error(`[admin/shop] customer grant failed user=${row.userId}: ${text}`);
    } finally {
      setIsGranting(false);
    }
  }

  async function onRevokeSubscription() {
    setIsRevoking(true);
    setMessage(null);
    setError(null);
    try {
      const result = await onSetSubscription({
        userId: row.userId,
        action: "revoke",
      });
      if (!result.ok) {
        setError(result.error.message);
        console.error(
          `[admin/shop] customer revoke failed user=${row.userId} code=${result.error.code} message=${result.error.message}`,
        );
        return;
      }
      setMessage(`Access revoked. Role sync jobs: ${result.roleSyncQueued}.`);
      console.info(
        `[admin/shop] customer access revoked user=${row.userId} role_sync_jobs=${result.roleSyncQueued}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to revoke subscription";
      setError(text);
      console.error(`[admin/shop] customer revoke failed user=${row.userId}: ${text}`);
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <div className="admin-surface-soft space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="admin-label">
          Email
          <input
            className="admin-input"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            placeholder="customer@email.com"
          />
        </label>
        <label className="admin-label">
          New password
          <input
            className="admin-input"
            type="password"
            value={passwordDraft}
            onChange={(event) => setPasswordDraft(event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        <div className="admin-label">
          Subscription status
          <div className="admin-input flex items-center text-xs font-mono text-slate-300">
            {row.subscriptionStatus ?? "none"} / tier {row.tier ?? "none"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="admin-label">
          Grant tier
          <select
            className="admin-input"
            value={tierDraft}
            onChange={(event) => setTierDraft(event.target.value as SubscriptionTier)}
          >
            <option value="basic">basic</option>
            <option value="advanced">advanced</option>
            <option value="pro">pro</option>
          </select>
        </label>
        <label className="admin-label">
          Grant duration days
          <input
            className="admin-input"
            value={durationDaysDraft}
            onChange={(event) => setDurationDaysDraft(event.target.value)}
          />
        </label>
        <div className="admin-label">
          Expires
          <div className="admin-input flex items-center text-xs text-slate-300">
            {formatDateTime(row.endsAt)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="admin-btn-secondary"
          onClick={() => void onSaveEmail()}
          disabled={isSavingEmail}
        >
          {isSavingEmail ? "Saving email..." : "Save email"}
        </button>
        <button
          type="button"
          className="admin-btn-secondary"
          onClick={() => void onSavePassword()}
          disabled={isSavingPassword}
        >
          {isSavingPassword ? "Setting password..." : "Set password"}
        </button>
        <button
          type="button"
          className="admin-btn-primary"
          onClick={() => void onGrantSubscription()}
          disabled={isGranting}
        >
          {isGranting ? "Granting..." : "Grant access"}
        </button>
        <button
          type="button"
          className="admin-btn-secondary"
          onClick={() => void onRevokeSubscription()}
          disabled={isRevoking}
        >
          {isRevoking ? "Revoking..." : "Revoke access"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}

export default function ShopCustomersPage() {
  const [search, setSearch] = useState("");
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const debouncedSearch = useMemo(() => search.trim(), [search]);

  const listPaymentCustomersRef = makeFunctionReference<
    "query",
    { limit?: number; search?: string },
    OperatorPaymentRow[]
  >("payments:listPaymentCustomers");
  const updateCustomerEmailRef = makeFunctionReference<
    "mutation",
    { userId: string; email: string },
    OperatorResult<{
      userId: string;
      email: string;
    }>
  >("payments:adminUpdatePaymentCustomerEmail");
  const setCustomerPasswordRef = makeFunctionReference<
    "action",
    { userId: string; password: string; invalidateExistingSessions?: boolean },
    OperatorResult<{
      userId: string;
      sessionsInvalidated: boolean;
    }>
  >("payments:adminSetPaymentCustomerPassword");
  const setCustomerSubscriptionRef = makeFunctionReference<
    "mutation",
    {
      userId: string;
      action: "grant" | "revoke";
      tier?: SubscriptionTier;
      durationDays?: number;
    },
    OperatorResult<{
      userId: string;
      subscriptionStatus: SubscriptionStatus;
      tier: SubscriptionTier | null;
      endsAt: number | null;
      roleSyncQueued: number;
    }>
  >("payments:adminSetPaymentCustomerSubscription");

  const rows = useQuery(listPaymentCustomersRef, {
    limit: 200,
    search: debouncedSearch || undefined,
  });
  const updateCustomerEmail = useMutation(updateCustomerEmailRef);
  const setCustomerPassword = useAction(setCustomerPasswordRef);
  const setCustomerSubscription = useMutation(setCustomerSubscriptionRef);

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
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {rows?.map((row) => {
              const rowKey = `${row.provider}:${row.userId}:${row.externalSubscriptionId ?? "none"}`;
              const isExpanded = expandedRowKey === rowKey;
              return (
                <Fragment key={rowKey}>
                  <tr>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-slate-100">{row.userEmail ?? row.userId}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">{row.userId}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        customer email: {row.customerEmail ?? "n/a"}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-300">
                      {row.subscriptionStatus ?? "none"}
                    </td>
                    <td className="px-3 py-3 align-top text-slate-300">{row.tier ?? "n/a"}</td>
                    <td className="px-3 py-3 align-top text-xs text-slate-300">
                      {formatDateTime(row.endsAt)}
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
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        onClick={() =>
                          setExpandedRowKey((current) => (current === rowKey ? null : rowKey))
                        }
                      >
                        {isExpanded ? "Close" : "Manage"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-3">
                        <CustomerActionsPanel
                          row={row}
                          onUpdateEmail={updateCustomerEmail}
                          onSetPassword={setCustomerPassword}
                          onSetSubscription={setCustomerSubscription}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
