"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { ConnectorTokenSheet } from "@/components/admin/connector-token-sheet";
import type {
  ConnectorRow,
  MirrorRuntimeStatusRow,
  MirrorQueueStatsRow,
  MirrorLatencyStatsRow,
  SeatSnapshotRow,
  ServerConfigRow,
  SourceGuildRow,
  BotGuildRow,
  SourceRow,
  SourceChannelRow,
  BotChannelRow,
} from "./connector-workspace";

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

const upsertServerConfigRef = makeFunctionReference<
  "mutation",
  {
    tenantKey: string;
    connectorId: string;
    guildId: string;
    seatLimit: number;
    seatEnforcementEnabled: boolean;
  },
  { ok: true }
>("discordServerConfig:upsertServerConfig");

const removeServerConfigRef = makeFunctionReference<
  "mutation",
  { tenantKey: string; connectorId: string; guildId: string },
  { ok: true; removed: boolean }
>("discordServerConfig:removeServerConfig");

// ── Helpers ────────────────────────────────────────────────────────────────

function renderLatency(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value)}ms`;
}

function formatDateTime(value: number | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

// ── Props ──────────────────────────────────────────────────────────────────

type ConnectorOverviewTabProps = {
  tenantKey: string;
  connectorId: string;
  connector: ConnectorRow;
  mirrorRuntime: MirrorRuntimeStatusRow | undefined;
  mirrorQueueStats: MirrorQueueStatsRow | undefined;
  mirrorLatencyStats: MirrorLatencyStatsRow | undefined;
  seatSnapshots: SeatSnapshotRow[];
  serverConfigs: ServerConfigRow[];
  sourceGuilds: SourceGuildRow[];
  botGuilds: BotGuildRow[];
  sources: SourceRow[];
  allChannels: SourceChannelRow[];
  botChannels: BotChannelRow[];
};

// ── Component ──────────────────────────────────────────────────────────────

export function ConnectorOverviewTab({
  tenantKey,
  connectorId,
  connector,
  mirrorRuntime,
  mirrorQueueStats,
  mirrorLatencyStats,
  seatSnapshots,
  serverConfigs,
  sourceGuilds,
  botGuilds,
}: ConnectorOverviewTabProps) {
  const [isUpdatingForwarding, setIsUpdatingForwarding] = useState(false);
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);

  // Seat config edit state
  const [editingSeatGuildId, setEditingSeatGuildId] = useState<string | null>(null);
  const [seatLimitDraft, setSeatLimitDraft] = useState("0");
  const [seatEnforcementDraft, setSeatEnforcementDraft] = useState(true);
  const [seatConfigSaving, setSeatConfigSaving] = useState(false);
  const [seatConfigMessage, setSeatConfigMessage] = useState<string | null>(null);
  const [seatConfigError, setSeatConfigError] = useState<string | null>(null);

  const doSetStatus = useMutation(setStatusRef);
  const doSetForwardingEnabled = useMutation(setForwardingEnabledRef);
  const doUpsertServerConfig = useMutation(upsertServerConfigRef);
  const doRemoveServerConfig = useMutation(removeServerConfigRef);

  const guildNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const guild of sourceGuilds) {
      map.set(guild.guildId, guild.name);
    }
    for (const guild of botGuilds) {
      if (!map.has(guild.guildId)) {
        map.set(guild.guildId, guild.name);
      }
    }
    return map;
  }, [sourceGuilds, botGuilds]);

  const serverConfigByGuildId = useMemo(
    () => new Map(serverConfigs.map((row) => [row.guildId, row])),
    [serverConfigs],
  );
  const seatSnapshotByGuildId = useMemo(
    () => new Map(seatSnapshots.map((row) => [row.guildId, row])),
    [seatSnapshots],
  );
  const configuredSeatRows = useMemo(
    () =>
      [...serverConfigs]
        .sort((a, b) => a.guildId.localeCompare(b.guildId))
        .map((config) => ({
          guildId: config.guildId,
          config,
          snapshot: seatSnapshotByGuildId.get(config.guildId) ?? null,
        })),
    [serverConfigs, seatSnapshotByGuildId],
  );

  function renderGuildLabel(guildId: string) {
    return `${guildNameById.get(guildId) ?? "Unknown guild"} (${guildId})`;
  }

  async function onToggleStatus() {
    const next = connector.status === "active" ? "paused" : "active";
    await doSetStatus({ tenantKey, connectorId, status: next });
  }

  async function onToggleForwarding() {
    const next = !(connector.forwardEnabled === true);
    setIsUpdatingForwarding(true);
    try {
      await doSetForwardingEnabled({ tenantKey, connectorId, enabled: next });
    } finally {
      setIsUpdatingForwarding(false);
    }
  }

  function startEditSeatConfig(guildId: string) {
    const existing = serverConfigByGuildId.get(guildId);
    const snapshot = seatSnapshotByGuildId.get(guildId);
    setEditingSeatGuildId(guildId);
    setSeatLimitDraft(String(existing?.seatLimit ?? snapshot?.seatLimit ?? 0));
    setSeatEnforcementDraft(existing?.seatEnforcementEnabled ?? true);
    setSeatConfigMessage(null);
    setSeatConfigError(null);
  }

  function cancelEditSeatConfig() {
    setEditingSeatGuildId(null);
    setSeatLimitDraft("0");
    setSeatEnforcementDraft(true);
    setSeatConfigMessage(null);
    setSeatConfigError(null);
  }

  async function onSaveSeatConfig() {
    if (!editingSeatGuildId) return;
    const parsedLimit = Number.parseInt(seatLimitDraft.trim(), 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      setSeatConfigError("Seat limit must be a non-negative integer.");
      return;
    }
    setSeatConfigSaving(true);
    setSeatConfigMessage(null);
    setSeatConfigError(null);
    try {
      await doUpsertServerConfig({
        tenantKey,
        connectorId,
        guildId: editingSeatGuildId,
        seatLimit: parsedLimit,
        seatEnforcementEnabled: seatEnforcementDraft,
      });
      setSeatConfigMessage(`Saved seat config for ${renderGuildLabel(editingSeatGuildId)}.`);
      setEditingSeatGuildId(null);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to save seat config";
      setSeatConfigError(text);
    } finally {
      setSeatConfigSaving(false);
    }
  }

  async function onDeleteSeatConfig(guildId: string) {
    setSeatConfigSaving(true);
    setSeatConfigMessage(null);
    setSeatConfigError(null);
    try {
      const result = await doRemoveServerConfig({ tenantKey, connectorId, guildId });
      if (editingSeatGuildId === guildId) {
        setEditingSeatGuildId(null);
      }
      setSeatConfigMessage(
        result.removed
          ? `Deleted seat config for ${renderGuildLabel(guildId)}.`
          : `No saved seat config found for ${renderGuildLabel(guildId)}.`,
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to delete seat config";
      setSeatConfigError(text);
    } finally {
      setSeatConfigSaving(false);
    }
  }

  const failedCount = mirrorQueueStats?.failed ?? 0;
  const pendingCount = mirrorQueueStats?.pending ?? 0;
  const totalCount = mirrorQueueStats?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <AdminSectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <span className="admin-chip">status: {connector.status}</span>
          <span className="admin-chip">
            mirroring: {connector.forwardEnabled === true ? "enabled" : "disabled"}
          </span>
          <span className="admin-chip">config: v{connector.configVersion}</span>
          <button type="button" onClick={() => void onToggleStatus()} className="admin-btn-secondary">
            Toggle status
          </button>
          <button
            type="button"
            onClick={() => setTokenSheetOpen(true)}
            className="admin-btn-secondary"
          >
            Rotate token
          </button>
          <button
            type="button"
            onClick={() => void onToggleForwarding()}
            disabled={isUpdatingForwarding}
            className="admin-btn-secondary"
          >
            {isUpdatingForwarding
              ? "Updating..."
              : connector.forwardEnabled === true
                ? "Disable mirroring"
                : "Enable mirroring"}
          </button>
        </div>
      </AdminSectionCard>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Queue stats card */}
        <AdminSectionCard title="Queue stats">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Pending</span>
              <span className="font-semibold text-slate-200">{pendingCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Failed</span>
              <span
                className={`font-semibold ${failedCount > 0 ? "text-red-400" : "text-slate-200"}`}
              >
                {failedCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total</span>
              <span className="font-semibold text-slate-200">{totalCount}</span>
            </div>
          </div>
        </AdminSectionCard>

        {/* Latency card */}
        <AdminSectionCard title="Latency (last 60m)">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Create p95</span>
              <span className="font-semibold text-slate-200">
                {renderLatency(mirrorLatencyStats?.create.p95Ms ?? null)}
                <span className="ml-1 text-xs text-slate-500">
                  (n={mirrorLatencyStats?.create.count ?? 0})
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Update p95</span>
              <span className="font-semibold text-slate-200">
                {renderLatency(mirrorLatencyStats?.update.p95Ms ?? null)}
                <span className="ml-1 text-xs text-slate-500">
                  (n={mirrorLatencyStats?.update.count ?? 0})
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Delete p95</span>
              <span className="font-semibold text-slate-200">
                {renderLatency(mirrorLatencyStats?.delete.p95Ms ?? null)}
                <span className="ml-1 text-xs text-slate-500">
                  (n={mirrorLatencyStats?.delete.count ?? 0})
                </span>
              </span>
            </div>
          </div>
        </AdminSectionCard>
      </div>

      {/* Mirror runtime */}
      <AdminSectionCard title="Mirror runtime">
        <div className="text-xs text-slate-300">
          <p>
            Mirror bot token configured:{" "}
            <strong>{mirrorRuntime?.hasMirrorBotToken ? "yes" : "no"}</strong>
          </p>
          <p className="mt-1">
            Dedicated mirror token in use:{" "}
            <strong>{mirrorRuntime?.usesDedicatedMirrorToken ? "yes" : "no"}</strong>
          </p>
          <p className="mt-1">
            Shared role-sync token fallback:{" "}
            <strong>{mirrorRuntime?.sharedRoleSyncTokenFallback ? "yes" : "no"}</strong>
          </p>
        </div>
      </AdminSectionCard>

      {/* Seat configs by guild */}
      <AdminSectionCard title="Seat configs by guild">
        {configuredSeatRows.length === 0 ? (
          <p className="text-xs text-slate-400">
            No saved seat configs for this connector yet. Configure seat enforcement in{" "}
            <Link href="/discord-bot" className="admin-link">
              Discord Bot
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs font-semibold text-slate-300">
                <tr>
                  <th className="px-3 py-2">Guild</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Seats</th>
                  <th className="px-3 py-2">Seat policy</th>
                  <th className="px-3 py-2">Checked</th>
                  <th className="px-3 py-2">Error</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
                {configuredSeatRows.map((row) => {
                  const snapshot = row.snapshot;
                  const isEditing = editingSeatGuildId === row.guildId;
                  return (
                    <tr key={`${tenantKey}:${connectorId}:${row.guildId}`}>
                      <td className="px-3 py-2">{renderGuildLabel(row.guildId)}</td>
                      <td className="px-3 py-2">
                        {snapshot ? (
                          snapshot.isOverLimit ? (
                            <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">
                              over-limit ({snapshot.status})
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                              ok ({snapshot.status})
                            </span>
                          )
                        ) : (
                          <span className="rounded-full border border-slate-500/30 bg-slate-500/20 px-2 py-0.5 text-xs font-semibold text-slate-200">
                            no snapshot
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {snapshot ? `${snapshot.seatsUsed} / ${snapshot.seatLimit}` : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <p className="text-xs text-slate-200">limit: {row.config.seatLimit}</p>
                          <p className="text-xs text-slate-400">
                            enforcement:{" "}
                            {row.config.seatEnforcementEnabled ? "enabled" : "disabled"}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2">{formatDateTime(snapshot?.checkedAt)}</td>
                      <td className="px-3 py-2">{snapshot?.lastError ?? "-"}</td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditSeatConfig(row.guildId)}
                            className="text-sm font-medium text-cyan-300 underline"
                            disabled={seatConfigSaving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteSeatConfig(row.guildId)}
                            className="text-sm font-medium text-rose-300 underline"
                            disabled={seatConfigSaving}
                          >
                            Delete
                          </button>
                        </div>
                        {isEditing ? (
                          <div className="mt-3 space-y-2 rounded-md border border-slate-800 bg-slate-950/50 p-2">
                            <label className="admin-label text-[11px]">
                              Seat limit
                              <input
                                type="number"
                                min={0}
                                value={seatLimitDraft}
                                onChange={(e) => setSeatLimitDraft(e.target.value)}
                                className="admin-input mt-1 w-28"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                              <input
                                type="checkbox"
                                checked={seatEnforcementDraft}
                                onChange={(e) => setSeatEnforcementDraft(e.target.checked)}
                              />
                              Enable enforcement
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void onSaveSeatConfig()}
                                className="admin-btn-secondary"
                                disabled={seatConfigSaving}
                              >
                                {seatConfigSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditSeatConfig}
                                className="admin-btn-secondary"
                                disabled={seatConfigSaving}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {seatConfigMessage ? (
          <p className="mt-3 text-sm text-emerald-400">{seatConfigMessage}</p>
        ) : null}
        {seatConfigError ? (
          <p className="mt-3 text-sm text-rose-400">{seatConfigError}</p>
        ) : null}
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
