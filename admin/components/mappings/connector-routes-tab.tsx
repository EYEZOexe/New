"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import type {
  SourceRow,
  MappingRow,
  SourceGuildRow,
  SourceChannelRow,
  BotGuildRow,
  BotChannelRow,
  SeatSnapshotRow,
  ServerConfigRow,
  SubscriptionTier,
} from "./connector-workspace";

// ── Module-level references ────────────────────────────────────────────────

const listSourceChannelsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string; guildId?: string },
  SourceChannelRow[]
>("discovery:listChannels");

const upsertSourceRef = makeFunctionReference<
  "mutation",
  {
    tenantKey: string;
    connectorId: string;
    guildId: string;
    channelId: string;
    isSource: boolean;
    isTarget: boolean;
    threadMode?: "include" | "exclude" | "only";
    isEnabled: boolean;
  },
  { ok: true }
>("connectors:upsertSource");

const removeSourceRef = makeFunctionReference<
  "mutation",
  { tenantKey: string; connectorId: string; channelId: string },
  { ok: true }
>("connectors:removeSource");

const upsertMappingRef = makeFunctionReference<
  "mutation",
  {
    tenantKey: string;
    connectorId: string;
    sourceChannelId: string;
    targetChannelId: string;
    dashboardEnabled?: boolean;
    minimumTier?: SubscriptionTier;
    priority?: number;
    transformJson?: unknown;
  },
  { ok: true }
>("connectors:upsertMapping");

const removeMappingRef = makeFunctionReference<
  "mutation",
  { tenantKey: string; connectorId: string; sourceChannelId: string },
  { ok: true }
>("connectors:removeMapping");

const requestChannelDiscoveryRef = makeFunctionReference<
  "mutation",
  { tenantKey: string; connectorId: string; guildId?: string },
  { ok: true; requestVersion: number }
>("connectors:requestChannelDiscovery");

// ── Helpers ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRolePingId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{5,25}$/.test(normalized)) return null;
  return normalized;
}

function extractRolePingId(transformJson: unknown): string {
  if (!isRecord(transformJson)) return "";
  return normalizeRolePingId(transformJson.rolePingId) ?? "";
}

function mergeRolePingIdIntoTransformJson(args: {
  transformJson: unknown;
  rolePingIdInput: string;
}): Record<string, unknown> | undefined {
  const base = isRecord(args.transformJson) ? { ...args.transformJson } : {};
  const normalizedRolePingId = normalizeRolePingId(args.rolePingIdInput);
  if (normalizedRolePingId) {
    base.rolePingId = normalizedRolePingId;
  } else {
    delete base.rolePingId;
  }
  return Object.keys(base).length > 0 ? base : undefined;
}

// ── Props ──────────────────────────────────────────────────────────────────

type ConnectorRoutesTabProps = {
  tenantKey: string;
  connectorId: string;
  sources: SourceRow[];
  mappings: MappingRow[];
  sourceGuilds: SourceGuildRow[];
  allChannels: SourceChannelRow[];
  botGuilds: BotGuildRow[];
  botChannels: BotChannelRow[];
  seatSnapshots: SeatSnapshotRow[];
  serverConfigs: ServerConfigRow[];
};

// ── Component ──────────────────────────────────────────────────────────────

export function ConnectorRoutesTab({
  tenantKey,
  connectorId,
  sources,
  mappings,
  sourceGuilds,
  allChannels,
  botGuilds,
  botChannels,
  seatSnapshots,
  serverConfigs,
}: ConnectorRoutesTabProps) {
  const hasRouteParams = tenantKey !== "" && connectorId !== "";

  // Source form state
  const [newSourceGuildId, setNewSourceGuildId] = useState("");
  const [newSourceChannelId, setNewSourceChannelId] = useState("");
  const [newSourceThreadMode, setNewSourceThreadMode] = useState("");
  const [newSourceEnabled, setNewSourceEnabled] = useState(true);
  const [editingSourceChannelId, setEditingSourceChannelId] = useState<string | null>(null);
  const [sourceFormMessage, setSourceFormMessage] = useState<string | null>(null);
  const [sourceFormError, setSourceFormError] = useState<string | null>(null);
  const [isRequestingChannels, setIsRequestingChannels] = useState(false);
  const [lastDiscoveryRequestVersion, setLastDiscoveryRequestVersion] = useState<number | null>(
    null,
  );

  // Target form state
  const [newTargetGuildId, setNewTargetGuildId] = useState("");
  const [newTargetChannelId, setNewTargetChannelId] = useState("");
  const [targetFormMessage, setTargetFormMessage] = useState<string | null>(null);
  const [targetFormError, setTargetFormError] = useState<string | null>(null);
  const [targetFormSaving, setTargetFormSaving] = useState(false);

  // Mapping form state
  const [sourceGuildFilterId, setSourceGuildFilterId] = useState("");
  const [newMappingSource, setNewMappingSource] = useState("");
  const [newMappingTarget, setNewMappingTarget] = useState("");
  const [newMappingPriority, setNewMappingPriority] = useState("");
  const [newMappingDashboardEnabled, setNewMappingDashboardEnabled] = useState(false);
  const [newMappingMinimumTier, setNewMappingMinimumTier] = useState<SubscriptionTier>("basic");
  const [newMappingRolePingId, setNewMappingRolePingId] = useState("");
  const [editingMappingSourceChannelId, setEditingMappingSourceChannelId] = useState<
    string | null
  >(null);
  const [mappingFormMessage, setMappingFormMessage] = useState<string | null>(null);
  const [mappingFormError, setMappingFormError] = useState<string | null>(null);

  const doUpsertSource = useMutation(upsertSourceRef);
  const doRemoveSource = useMutation(removeSourceRef);
  const doUpsertMapping = useMutation(upsertMappingRef);
  const doRemoveMapping = useMutation(removeMappingRef);
  const doRequestChannelDiscovery = useMutation(requestChannelDiscoveryRef);

  // Dynamic source channels query (guild-filtered) — practical form dependency
  const sourceChannelsArgs = !hasRouteParams
    ? "skip"
    : newSourceGuildId
      ? { tenantKey, connectorId, guildId: newSourceGuildId }
      : { tenantKey, connectorId };
  const sourceChannels = useQuery(listSourceChannelsRef, sourceChannelsArgs) ?? [];

  // Derived maps
  const guildNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const guild of sourceGuilds) map.set(guild.guildId, guild.name);
    for (const guild of botGuilds) {
      if (!map.has(guild.guildId)) map.set(guild.guildId, guild.name);
    }
    return map;
  }, [sourceGuilds, botGuilds]);

  const channelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const channel of allChannels) map.set(channel.channelId, channel.name);
    for (const channel of botChannels) {
      if (!map.has(channel.channelId)) map.set(channel.channelId, channel.name);
    }
    return map;
  }, [allChannels, botChannels]);

  const guildIdByChannelId = useMemo(() => {
    const map = new Map<string, string>();
    for (const source of sources) map.set(source.channelId, source.guildId);
    for (const channel of botChannels) {
      if (!map.has(channel.channelId)) map.set(channel.channelId, channel.guildId);
    }
    return map;
  }, [sources, botChannels]);

  const botChannelById = useMemo(
    () => new Map(botChannels.map((channel) => [channel.channelId, channel])),
    [botChannels],
  );

  const selectedMappingTargetGuildId = newTargetGuildId.trim();

  const serverConfigByGuildId = useMemo(
    () => new Map(serverConfigs.map((row) => [row.guildId, row])),
    [serverConfigs],
  );

  const unconfiguredSeatSnapshots = useMemo(
    () =>
      seatSnapshots
        .filter((snapshot) => !serverConfigByGuildId.has(snapshot.guildId))
        .sort((a, b) => a.guildId.localeCompare(b.guildId)),
    [seatSnapshots, serverConfigByGuildId],
  );

  const availableChannels = useMemo(() => {
    const byChannelId = new Map<
      string,
      { guildId: string; channelId: string; isSource: boolean; isTarget: boolean }
    >();
    for (const source of sources) {
      if (!source.isEnabled || !source.guildId || !source.channelId) continue;
      byChannelId.set(source.channelId, {
        guildId: source.guildId,
        channelId: source.channelId,
        isSource: source.isSource ?? true,
        isTarget: source.isTarget === true,
      });
    }
    const rows = Array.from(byChannelId.values());
    rows.sort((a, b) => {
      const guildCmp = renderGuildLabel(a.guildId).localeCompare(renderGuildLabel(b.guildId));
      if (guildCmp !== 0) return guildCmp;
      return renderChannelLabel(a.channelId).localeCompare(renderChannelLabel(b.channelId));
    });
    return rows;
  }, [sources, guildNameById, channelNameById]);

  const mappingSourceOptions = useMemo(() => {
    const scoped = sourceGuildFilterId
      ? availableChannels.filter((channel) => channel.guildId === sourceGuildFilterId)
      : availableChannels;
    return scoped.filter((channel) => channel.isSource);
  }, [availableChannels, sourceGuildFilterId]);

  const mappingTargetOptions = useMemo(
    () =>
      selectedMappingTargetGuildId
        ? botChannels.filter((channel) => channel.guildId === selectedMappingTargetGuildId)
        : [],
    [botChannels, selectedMappingTargetGuildId],
  );

  const wizardTargetChannels = useMemo(
    () =>
      newTargetGuildId
        ? botChannels.filter((channel) => channel.guildId === newTargetGuildId)
        : [],
    [botChannels, newTargetGuildId],
  );

  // Reset source channel when guild changes
  useEffect(() => {
    if (!newSourceGuildId || !newSourceChannelId) return;
    if (editingSourceChannelId === newSourceChannelId) return;
    if (!sourceChannels.some((channel) => channel.channelId === newSourceChannelId)) {
      setNewSourceChannelId("");
    }
  }, [newSourceGuildId, newSourceChannelId, sourceChannels, editingSourceChannelId]);

  // Default target guild to first bot guild
  useEffect(() => {
    if (botGuilds.length === 0) {
      setNewTargetGuildId("");
      return;
    }
    const exists = botGuilds.some((guild) => guild.guildId === newTargetGuildId);
    if (!exists) {
      setNewTargetGuildId(botGuilds[0].guildId);
    }
  }, [botGuilds, newTargetGuildId]);

  // Reset target channel when guild changes
  useEffect(() => {
    if (!newTargetGuildId || !newTargetChannelId) return;
    const exists = botChannels.some(
      (channel) =>
        channel.guildId === newTargetGuildId && channel.channelId === newTargetChannelId,
    );
    if (!exists) {
      setNewTargetChannelId("");
    }
  }, [newTargetGuildId, newTargetChannelId, botChannels]);

  // Reset mapping selections when options change
  useEffect(() => {
    if (editingMappingSourceChannelId && newMappingSource === editingMappingSourceChannelId) return;
    if (
      newMappingSource &&
      !mappingSourceOptions.some((channel) => channel.channelId === newMappingSource)
    ) {
      setNewMappingSource("");
    }
    if (
      newMappingTarget &&
      !mappingTargetOptions.some((channel) => channel.channelId === newMappingTarget)
    ) {
      setNewMappingTarget("");
    }
  }, [
    mappingSourceOptions,
    mappingTargetOptions,
    newMappingSource,
    newMappingTarget,
    editingMappingSourceChannelId,
  ]);

  // ── Label helpers ──────────────────────────────────────────────────────

  function renderGuildLabel(guildId: string) {
    return `${guildNameById.get(guildId) ?? "Unknown guild"} (${guildId})`;
  }

  function renderChannelLabel(channelId: string) {
    return `${channelNameById.get(channelId) ?? "Unknown channel"} (${channelId})`;
  }

  function renderChannelRouteLabel(channelId: string) {
    const guildId = guildIdByChannelId.get(channelId);
    if (!guildId) return renderChannelLabel(channelId);
    return `${renderGuildLabel(guildId)} / ${renderChannelLabel(channelId)}`;
  }

  // ── Source form ────────────────────────────────────────────────────────

  function resetSourceForm() {
    setEditingSourceChannelId(null);
    setNewSourceGuildId("");
    setNewSourceChannelId("");
    setNewSourceThreadMode("");
    setNewSourceEnabled(true);
  }

  function startEditSource(source: SourceRow) {
    setEditingSourceChannelId(source.channelId);
    setNewSourceGuildId(source.guildId);
    setNewSourceChannelId(source.channelId);
    setNewSourceThreadMode(source.threadMode ?? "");
    setNewSourceEnabled(source.isEnabled);
    setSourceFormMessage(null);
    setSourceFormError(null);
  }

  function cancelEditSource() {
    resetSourceForm();
    setSourceFormMessage(null);
    setSourceFormError(null);
  }

  async function onSubmitSource() {
    if (!hasRouteParams || !newSourceGuildId || !newSourceChannelId) return;
    setSourceFormMessage(null);
    setSourceFormError(null);
    try {
      await doUpsertSource({
        tenantKey,
        connectorId,
        guildId: newSourceGuildId,
        channelId: newSourceChannelId,
        isSource: true,
        isTarget: false,
        threadMode:
          newSourceThreadMode === "include" ||
          newSourceThreadMode === "exclude" ||
          newSourceThreadMode === "only"
            ? newSourceThreadMode
            : undefined,
        isEnabled: newSourceEnabled,
      });
      setSourceFormMessage(
        editingSourceChannelId
          ? `Updated available channel ${renderChannelLabel(newSourceChannelId)}.`
          : `Added available channel ${renderChannelLabel(newSourceChannelId)}.`,
      );
      if (editingSourceChannelId) {
        setEditingSourceChannelId(null);
      } else {
        resetSourceForm();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to save available channel";
      setSourceFormError(text);
    }
  }

  async function onRequestChannels() {
    if (!hasRouteParams || !newSourceGuildId) return;
    setIsRequestingChannels(true);
    try {
      const result = await doRequestChannelDiscovery({
        tenantKey,
        connectorId,
        guildId: newSourceGuildId,
      });
      setLastDiscoveryRequestVersion(result.requestVersion);
    } finally {
      setIsRequestingChannels(false);
    }
  }

  // ── Target form ────────────────────────────────────────────────────────

  async function onAddTargetChannel() {
    if (!hasRouteParams || !newTargetGuildId || !newTargetChannelId) return;
    setTargetFormMessage(null);
    setTargetFormError(null);
    setTargetFormSaving(true);
    try {
      await doUpsertSource({
        tenantKey,
        connectorId,
        guildId: newTargetGuildId,
        channelId: newTargetChannelId,
        isSource: false,
        isTarget: true,
        isEnabled: true,
      });
      setTargetFormMessage(
        `Registered bot target channel ${renderChannelRouteLabel(newTargetChannelId)}.`,
      );
      setNewTargetChannelId("");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to register target channel";
      setTargetFormError(text);
    } finally {
      setTargetFormSaving(false);
    }
  }

  // ── Mapping form ───────────────────────────────────────────────────────

  function resetMappingForm() {
    setEditingMappingSourceChannelId(null);
    setNewMappingSource("");
    setNewMappingTarget("");
    setNewMappingPriority("");
    setNewMappingDashboardEnabled(false);
    setNewMappingMinimumTier("basic");
    setNewMappingRolePingId("");
  }

  function startEditMapping(mapping: MappingRow) {
    const mappedTargetGuildId =
      botChannelById.get(mapping.targetChannelId)?.guildId ??
      guildIdByChannelId.get(mapping.targetChannelId);
    if (mappedTargetGuildId) {
      setNewTargetGuildId(mappedTargetGuildId);
    }
    setEditingMappingSourceChannelId(mapping.sourceChannelId);
    setNewMappingSource(mapping.sourceChannelId);
    setNewMappingTarget(mapping.targetChannelId);
    setNewMappingPriority(
      typeof mapping.priority === "number" && Number.isFinite(mapping.priority)
        ? String(mapping.priority)
        : "",
    );
    setNewMappingDashboardEnabled(mapping.dashboardEnabled === true);
    setNewMappingMinimumTier(mapping.minimumTier ?? "basic");
    setNewMappingRolePingId(extractRolePingId(mapping.transformJson));
    setMappingFormMessage(null);
    setMappingFormError(null);
  }

  function cancelEditMapping() {
    resetMappingForm();
    setMappingFormMessage(null);
    setMappingFormError(null);
  }

  async function onSubmitMapping() {
    if (!hasRouteParams || !newMappingSource || !newMappingTarget) return;
    setMappingFormMessage(null);
    setMappingFormError(null);
    const prio =
      newMappingPriority.trim() === "" ? undefined : Number(newMappingPriority.trim());
    const normalizedRolePingId = normalizeRolePingId(newMappingRolePingId);
    if (newMappingRolePingId.trim() && !normalizedRolePingId) {
      setMappingFormError("Role ping must be a valid Discord role ID.");
      return;
    }
    try {
      const targetChannel = botChannelById.get(newMappingTarget);
      if (!targetChannel) {
        throw new Error("target_channel_not_synced_from_bot");
      }
      const targetGuildId = targetChannel.guildId.trim();
      if (!targetGuildId) {
        throw new Error("target_guild_missing_for_channel");
      }
      if (selectedMappingTargetGuildId && targetGuildId !== selectedMappingTargetGuildId) {
        throw new Error("target_channel_outside_selected_target_guild");
      }

      await doUpsertSource({
        tenantKey,
        connectorId,
        guildId: targetGuildId,
        channelId: newMappingTarget,
        isSource: false,
        isTarget: true,
        isEnabled: true,
      });

      const existingMapping =
        mappings.find((mapping) => mapping.sourceChannelId === newMappingSource) ??
        (editingMappingSourceChannelId
          ? mappings.find(
              (mapping) => mapping.sourceChannelId === editingMappingSourceChannelId,
            )
          : undefined);
      const transformJson = mergeRolePingIdIntoTransformJson({
        transformJson: existingMapping?.transformJson,
        rolePingIdInput: newMappingRolePingId,
      });

      await doUpsertMapping({
        tenantKey,
        connectorId,
        sourceChannelId: newMappingSource,
        targetChannelId: newMappingTarget,
        dashboardEnabled: newMappingDashboardEnabled,
        minimumTier: newMappingDashboardEnabled ? newMappingMinimumTier : undefined,
        priority: Number.isFinite(prio) ? prio : undefined,
        transformJson,
      });

      if (editingMappingSourceChannelId && editingMappingSourceChannelId !== newMappingSource) {
        await doRemoveMapping({
          tenantKey,
          connectorId,
          sourceChannelId: editingMappingSourceChannelId,
        });
      }

      setMappingFormMessage(
        editingMappingSourceChannelId
          ? `Updated mapping ${renderChannelRouteLabel(newMappingSource)} -> ${renderChannelRouteLabel(newMappingTarget)}.`
          : `Added mapping ${renderChannelRouteLabel(newMappingSource)} -> ${renderChannelRouteLabel(newMappingTarget)}.`,
      );
      resetMappingForm();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to save mapping";
      setMappingFormError(text);
    }
  }

  return (
    <div className="space-y-8">
      {/* Quick Setup Wizard */}
      <AdminSectionCard title="Quick Setup Wizard">
        <div className="admin-surface-soft">
          <p className="text-xs text-slate-300">
            Step 1: register plugin source channels. Step 2: register bot target channels. Step 3:
            create source &rarr; target routes below.
          </p>

          {/* Step 1: Source channels */}
          <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs font-semibold text-cyan-200">
              Step 1: Source channels (Vencord plugin)
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="admin-label">
                Guild (plugin-discovered)
                <select
                  className="admin-input"
                  value={newSourceGuildId}
                  onChange={(e) => setNewSourceGuildId(e.target.value)}
                >
                  <option value="">Select guild</option>
                  {sourceGuilds.map((g) => (
                    <option key={g._id} value={g.guildId}>
                      {g.name} ({g.guildId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-label">
                Channel (from selected plugin guild)
                <select
                  className="admin-input"
                  value={newSourceChannelId}
                  onChange={(e) => setNewSourceChannelId(e.target.value)}
                  disabled={Boolean(editingSourceChannelId)}
                >
                  <option value="">Select channel</option>
                  {sourceChannels.map((channel) => (
                    <option key={channel._id} value={channel.channelId}>
                      {channel.name} ({channel.channelId})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="admin-label">
                Thread mode
                <select
                  className="admin-input w-40"
                  value={newSourceThreadMode}
                  onChange={(e) => setNewSourceThreadMode(e.target.value)}
                >
                  <option value="">default</option>
                  <option value="include">include</option>
                  <option value="exclude">exclude</option>
                  <option value="only">only</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={newSourceEnabled}
                  onChange={(e) => setNewSourceEnabled(e.target.checked)}
                />
                Enabled
              </label>
              <button
                type="button"
                onClick={() => void onRequestChannels()}
                disabled={!newSourceGuildId || isRequestingChannels}
                className="admin-btn-secondary"
              >
                {isRequestingChannels ? "Requesting..." : "Fetch channels"}
              </button>
              <button
                type="button"
                onClick={() => void onSubmitSource()}
                className="admin-btn-primary"
              >
                {editingSourceChannelId ? "Save source" : "Add source"}
              </button>
              {editingSourceChannelId ? (
                <button
                  type="button"
                  onClick={cancelEditSource}
                  className="admin-btn-secondary"
                >
                  Cancel
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Guilds sync automatically from the plugin. Select a guild, click{" "}
              <strong>Fetch channels</strong>, pick a channel, and save it as available. Source
              registration is source-only in this step.
              {lastDiscoveryRequestVersion
                ? ` Last fetch request: v${lastDiscoveryRequestVersion}.`
                : ""}
              {editingSourceChannelId
                ? " While editing, channel ID is locked to preserve mapping references."
                : ""}
            </p>
            {sourceFormMessage ? (
              <p className="mt-3 text-sm text-emerald-400">{sourceFormMessage}</p>
            ) : null}
            {sourceFormError ? (
              <p className="mt-3 text-sm text-rose-400">{sourceFormError}</p>
            ) : null}
          </div>

          {/* Step 2: Target channels */}
          <div className="mt-4 rounded-md border border-cyan-900/50 bg-cyan-950/20 p-3">
            <p className="text-xs font-semibold text-cyan-200">
              Step 2: Target channels (Discord bot guilds)
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="admin-label">
                Target guild (bot)
                <select
                  className="admin-input"
                  value={newTargetGuildId}
                  onChange={(e) => setNewTargetGuildId(e.target.value)}
                >
                  <option value="">Select target guild</option>
                  {botGuilds.map((guild) => (
                    <option key={`bot-guild-${guild.guildId}`} value={guild.guildId}>
                      {guild.name} ({guild.guildId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-label">
                Target channel (bot mirror)
                <select
                  className="admin-input"
                  value={newTargetChannelId}
                  onChange={(e) => setNewTargetChannelId(e.target.value)}
                  disabled={!newTargetGuildId}
                >
                  <option value="">Select target channel</option>
                  {wizardTargetChannels.map((channel) => (
                    <option key={`wizard-target-${channel.channelId}`} value={channel.channelId}>
                      {channel.name} ({channel.channelId})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onAddTargetChannel()}
                disabled={targetFormSaving || !newTargetGuildId || !newTargetChannelId}
                className="admin-btn-primary"
              >
                {targetFormSaving ? "Saving..." : "Add target channel"}
              </button>
              <p className="text-xs text-cyan-100/80">
                Bot guild/channel catalogs sync automatically from Discord-Bot runtime.
              </p>
            </div>
            {targetFormMessage ? (
              <p className="mt-3 text-sm text-emerald-400">{targetFormMessage}</p>
            ) : null}
            {targetFormError ? (
              <p className="mt-3 text-sm text-rose-400">{targetFormError}</p>
            ) : null}
          </div>
        </div>
      </AdminSectionCard>

      {/* Channel registry */}
      <AdminTableShell
        title="Configured channel registry (sources + targets)"
        isEmpty={sources.length === 0}
        emptyMessage="No available channels yet."
        tableClassName="overflow-x-auto"
      >
        <table className="w-full table-auto text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-xs font-semibold text-slate-300">
            <tr>
              <th className="px-3 py-2">Guild</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Thread</th>
              <th className="px-3 py-2">Enabled</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
            {sources.map((s) => (
              <tr key={s._id}>
                <td className="px-3 py-2 align-top">{renderGuildLabel(s.guildId)}</td>
                <td className="px-3 py-2 align-top break-all">{renderChannelLabel(s.channelId)}</td>
                <td className="px-3 py-2">{s.threadMode ?? "-"}</td>
                <td className="px-3 py-2">{s.isEnabled ? "yes" : "no"}</td>
                <td className="px-3 py-2">
                  {s.isSource ?? true
                    ? s.isTarget === true
                      ? "source + target (legacy)"
                      : "source"
                    : s.isTarget === true
                      ? "target"
                      : "source (legacy)"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {s.isSource ?? true ? (
                      <button
                        type="button"
                        onClick={() => startEditSource(s)}
                        className="text-sm font-medium text-cyan-300 underline"
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await doRemoveSource({ tenantKey, connectorId, channelId: s.channelId });
                          if (editingSourceChannelId === s.channelId) {
                            cancelEditSource();
                          }
                          setSourceFormMessage(
                            `Removed available channel ${renderChannelLabel(s.channelId)}.`,
                          );
                        } catch (error) {
                          const text =
                            error instanceof Error
                              ? error.message
                              : "Failed to remove available channel";
                          setSourceFormError(text);
                        }
                      }}
                      className="text-sm font-medium text-rose-300 underline"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>

      {/* Mappings form + table */}
      <div>
        <AdminSectionCard title="Source (Plugin) -> Target (Bot) Mappings">
          <div className="admin-surface-soft">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="admin-label">
                Source guild filter (plugin)
                <select
                  className="admin-input mt-1"
                  value={sourceGuildFilterId}
                  onChange={(e) => setSourceGuildFilterId(e.target.value)}
                >
                  <option value="">All source guilds</option>
                  {sourceGuilds.map((g) => (
                    <option key={`src-guild-${g._id}`} value={g.guildId}>
                      {g.name} ({g.guildId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-label">
                Target guild (from Step 2)
                <div className="admin-input mt-1 flex items-center">
                  {selectedMappingTargetGuildId
                    ? renderGuildLabel(selectedMappingTargetGuildId)
                    : "Select a target guild in Step 2 above"}
                </div>
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="admin-label">
                Source channel (plugin ingest)
                <select
                  className="admin-input"
                  value={newMappingSource}
                  onChange={(e) => setNewMappingSource(e.target.value)}
                >
                  <option value="">Select source</option>
                  {mappingSourceOptions.map((channel) => (
                    <option key={`src-${channel.channelId}`} value={channel.channelId}>
                      {renderGuildLabel(channel.guildId)} / {renderChannelLabel(channel.channelId)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-label">
                Target channel (bot mirror, from Step 2 guild)
                <select
                  className="admin-input"
                  value={newMappingTarget}
                  onChange={(e) => setNewMappingTarget(e.target.value)}
                  disabled={!selectedMappingTargetGuildId}
                >
                  <option value="">Select target</option>
                  {mappingTargetOptions.map((channel) => (
                    <option key={`dst-${channel.channelId}`} value={channel.channelId}>
                      {renderGuildLabel(channel.guildId)} / {renderChannelLabel(channel.channelId)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {availableChannels.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                Add at least one enabled source channel in Step 1 before creating routes.
              </p>
            ) : !selectedMappingTargetGuildId ? (
              <p className="mt-3 text-xs text-slate-400">
                Select a target guild in Step 2 before creating routes.
              </p>
            ) : mappingSourceOptions.length === 0 || mappingTargetOptions.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                Ensure you have source options (Step 1) and bot target channel options (Step 2).
              </p>
            ) : null}

            <p className="mt-3 text-xs text-slate-400">
              These routes define how plugin source channels map to bot target channels. Advanced
              dashboard controls are optional.
              {editingMappingSourceChannelId
                ? " Editing keeps this row in place and updates it directly."
                : ""}
            </p>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => void onSubmitMapping()}
                className="admin-btn-primary"
              >
                {editingMappingSourceChannelId ? "Save mapping" : "Add mapping"}
              </button>
              {editingMappingSourceChannelId ? (
                <button
                  type="button"
                  onClick={cancelEditMapping}
                  className="admin-btn-secondary"
                >
                  Cancel
                </button>
              ) : null}
            </div>

            <details className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                Advanced route options
              </summary>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    checked={newMappingDashboardEnabled}
                    onChange={(e) => setNewMappingDashboardEnabled(e.target.checked)}
                  />
                  Visible on dashboard
                </label>
                <label className="admin-label">
                  Minimum tier
                  <select
                    className="admin-input w-36"
                    value={newMappingMinimumTier}
                    onChange={(e) => setNewMappingMinimumTier(e.target.value as SubscriptionTier)}
                    disabled={!newMappingDashboardEnabled}
                  >
                    <option value="basic">basic</option>
                    <option value="advanced">advanced</option>
                    <option value="pro">pro</option>
                  </select>
                </label>
                <label className="admin-label">
                  Priority
                  <input
                    value={newMappingPriority}
                    onChange={(e) => setNewMappingPriority(e.target.value)}
                    className="admin-input w-32"
                    placeholder="(optional)"
                  />
                </label>
                <label className="admin-label">
                  Role ping ID
                  <input
                    value={newMappingRolePingId}
                    onChange={(e) => setNewMappingRolePingId(e.target.value)}
                    className="admin-input w-52"
                    placeholder="123456789012345678"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Optional: when set, mirrored posts in this target channel will include a role
                mention outside the embed (<code>{`<@&roleId>`}</code>).
              </p>
            </details>

            <div>
              <p className="mt-3 text-xs text-slate-400">
                Target selection is now always bot-side and scoped to Step 2.
              </p>
            </div>
            {mappingFormMessage ? (
              <p className="mt-3 text-sm text-emerald-400">{mappingFormMessage}</p>
            ) : null}
            {mappingFormError ? (
              <p className="mt-3 text-sm text-rose-400">{mappingFormError}</p>
            ) : null}
          </div>
        </AdminSectionCard>

        <AdminTableShell
          title="Configured source->target routes"
          isEmpty={mappings.length === 0}
          emptyMessage="No mappings yet."
          tableClassName="overflow-x-auto"
        >
          <table className="w-full table-auto text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-xs font-semibold text-slate-300">
              <tr>
                <th className="px-3 py-2">Source (plugin)</th>
                <th className="px-3 py-2">Target (bot)</th>
                <th className="px-3 py-2">Role ping</th>
                <th className="px-3 py-2">Dashboard</th>
                <th className="px-3 py-2">Min tier</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
              {mappings.map((m) => {
                const rolePingId = extractRolePingId(m.transformJson);
                return (
                  <tr key={m._id}>
                    <td className="px-3 py-2 align-top break-all">
                      {renderChannelRouteLabel(m.sourceChannelId)}
                    </td>
                    <td className="px-3 py-2 align-top break-all">
                      {renderChannelRouteLabel(m.targetChannelId)}
                    </td>
                    <td className="px-3 py-2">
                      {rolePingId ? (
                        <span className="text-xs text-slate-200">{`<@&${rolePingId}>`}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.dashboardEnabled === true ? (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          visible
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-500/30 bg-slate-600/20 px-2 py-0.5 text-xs font-medium text-slate-200">
                          hidden
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{m.minimumTier ?? "-"}</td>
                    <td className="px-3 py-2">{m.priority ?? "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditMapping(m)}
                          className="text-sm font-medium text-cyan-300 underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await doRemoveMapping({
                                tenantKey,
                                connectorId,
                                sourceChannelId: m.sourceChannelId,
                              });
                              if (editingMappingSourceChannelId === m.sourceChannelId) {
                                cancelEditMapping();
                              }
                              setMappingFormMessage(
                                `Removed mapping ${renderChannelRouteLabel(m.sourceChannelId)} -> ${renderChannelRouteLabel(m.targetChannelId)}.`,
                              );
                            } catch (error) {
                              const text =
                                error instanceof Error
                                  ? error.message
                                  : "Failed to remove mapping";
                              setMappingFormError(text);
                            }
                          }}
                          className="text-sm font-medium text-rose-300 underline"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      {/* Unconfigured seat snapshots (Routes tab only) */}
      {unconfiguredSeatSnapshots.length > 0 ? (
        <details className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-300">
            Unconfigured seat snapshots ({unconfiguredSeatSnapshots.length})
          </summary>
          <p className="mt-2 text-xs text-slate-400">
            These are audit snapshots without saved seat configs. They are read-only here.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs font-semibold text-slate-300">
                <tr>
                  <th className="px-3 py-2">Guild</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Seats</th>
                  <th className="px-3 py-2">Checked</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
                {unconfiguredSeatSnapshots.map((snapshot) => (
                  <tr
                    key={`${snapshot.tenantKey}:${snapshot.connectorId}:${snapshot.guildId}`}
                  >
                    <td className="px-3 py-2">{renderGuildLabel(snapshot.guildId)}</td>
                    <td className="px-3 py-2">
                      {snapshot.isOverLimit ? (
                        <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">
                          over-limit ({snapshot.status})
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          ok ({snapshot.status})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {snapshot.seatsUsed} / {snapshot.seatLimit}
                    </td>
                    <td className="px-3 py-2">
                      {snapshot.checkedAt
                        ? new Date(snapshot.checkedAt).toLocaleString()
                        : "n/a"}
                    </td>
                    <td className="px-3 py-2">{snapshot.lastError ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
