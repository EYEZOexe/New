"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { ConnectorTokenSheet } from "@/components/admin/connector-token-sheet";
import type { ConnectorRow } from "./connector-workspace";

// ── Module-level mutation references ──────────────────────────────────────

const setStatusRef = makeFunctionReference<
  "mutation",
  { tenantKey: string; connectorId: string; status: "active" | "paused" },
  { ok: true }
>("connectors:setConnectorStatus");

const setForwardingEnabledRef = makeFunctionReference<
  "mutation",
  { tenantKey: string; connectorId: string; enabled: boolean },
  { ok: true }
>("connectors:setForwardingEnabled");

// ── Props ──────────────────────────────────────────────────────────────────

type ConnectorSettingsTabProps = {
  tenantKey: string;
  connectorId: string;
  connector: ConnectorRow;
};

// ── Component ──────────────────────────────────────────────────────────────

export function ConnectorSettingsTab({
  tenantKey,
  connectorId,
  connector,
}: ConnectorSettingsTabProps) {
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);
  const [isUpdatingForwarding, setIsUpdatingForwarding] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<string | null>(null);

  const doSetStatus = useMutation(setStatusRef);
  const doSetForwardingEnabled = useMutation(setForwardingEnabledRef);

  async function onToggleStatus() {
    const next = connector.status === "active" ? "paused" : "active";
    setIsUpdatingStatus(true);
    setStatusMessage(null);
    try {
      await doSetStatus({ tenantKey, connectorId, status: next });
      setStatusMessage(`Status updated to ${next}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function onToggleForwarding() {
    const next = !(connector.forwardEnabled === true);
    setIsUpdatingForwarding(true);
    setForwardingMessage(null);
    try {
      await doSetForwardingEnabled({ tenantKey, connectorId, enabled: next });
      setForwardingMessage(`Mirroring ${next ? "enabled" : "disabled"}.`);
    } catch (error) {
      setForwardingMessage(
        error instanceof Error ? error.message : "Failed to update mirroring.",
      );
    } finally {
      setIsUpdatingForwarding(false);
    }
  }

  const isForwardingEnabled = connector.forwardEnabled === true;

  return (
    <div className="space-y-6">
      {/* Token management */}
      <AdminSectionCard title="Token management">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-400">Current token</p>
            <p className="mt-1 font-mono text-sm text-slate-300">
              {"•".repeat(40)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Token is not shown for security. Rotate to get a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTokenSheetOpen(true)}
            className="admin-btn-secondary"
          >
            Rotate token
          </button>
        </div>
      </AdminSectionCard>

      {/* Mirroring */}
      <AdminSectionCard title="Mirroring">
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Mirroring is currently{" "}
            <strong className={isForwardingEnabled ? "text-emerald-400" : "text-slate-400"}>
              {isForwardingEnabled ? "enabled" : "disabled"}
            </strong>
            .
          </p>
          <button
            type="button"
            onClick={() => void onToggleForwarding()}
            disabled={isUpdatingForwarding}
            className="admin-btn-secondary"
          >
            {isUpdatingForwarding
              ? "Updating..."
              : isForwardingEnabled
                ? "Disable mirroring"
                : "Enable mirroring"}
          </button>
          {forwardingMessage ? (
            <p className="text-sm text-emerald-400">{forwardingMessage}</p>
          ) : null}
        </div>
      </AdminSectionCard>

      {/* Danger zone */}
      <AdminSectionCard title="Danger zone">
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Connector status is currently{" "}
            <strong
              className={connector.status === "active" ? "text-emerald-400" : "text-amber-400"}
            >
              {connector.status}
            </strong>
            .
          </p>
          <p className="text-xs text-slate-400">
            Pausing the connector stops it from processing new events. Existing queued jobs will
            continue to run.
          </p>
          <button
            type="button"
            onClick={() => void onToggleStatus()}
            disabled={isUpdatingStatus}
            className="rounded-md border border-amber-600/50 bg-amber-950/30 px-3 py-1.5 text-sm font-medium text-amber-300 transition-colors hover:border-amber-500/70 hover:bg-amber-900/30 disabled:opacity-50"
          >
            {isUpdatingStatus
              ? "Updating..."
              : connector.status === "active"
                ? "Pause connector"
                : "Activate connector"}
          </button>
          {statusMessage ? (
            <p className="text-sm text-emerald-400">{statusMessage}</p>
          ) : null}
        </div>
      </AdminSectionCard>

      <ConnectorTokenSheet
        open={tokenSheetOpen}
        onOpenChange={setTokenSheetOpen}
        tenantKey={tenantKey}
        connectorId={connectorId}
      />
    </div>
  );
}
