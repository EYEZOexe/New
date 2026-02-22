"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminTableShell } from "@/components/admin/admin-table-shell";

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

type SourceRow = {
  _id: string;
  guildId: string;
  channelId: string;
  isSource?: boolean;
  isTarget?: boolean;
  threadMode?: "include" | "exclude" | "only";
  isEnabled: boolean;
};

type MappingRow = {
  _id: string;
  sourceChannelId: string;
  targetChannelId: string;
  dashboardEnabled?: boolean;
  minimumTier?: "basic" | "advanced" | "pro";
  priority?: number;
};

type SubscriptionTier = "basic" | "advanced" | "pro";

type GuildRow = { _id: string; guildId: string; name: string };
type ChannelRow = { _id: string; channelId: string; guildId: string; name: string };
type MirrorRuntimeStatusRow = {
  hasMirrorBotToken: boolean;
  usesDedicatedMirrorToken: boolean;
  sharedRoleSyncTokenFallback: boolean;
};
type MirrorQueueStatsRow = {
  pending: number;
  pendingReady: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  updatedAt: number;
};
type MirrorLatencySummaryRow = {
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};
type MirrorLatencyStatsRow = {
  windowMinutes: number;
  create: MirrorLatencySummaryRow;
  update: MirrorLatencySummaryRow;
  delete: MirrorLatencySummaryRow;
};
type MirrorJobRow = {
  jobId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  targetChannelId: string;
  eventType: "create" | "update" | "delete";
  status: "pending" | "processing" | "completed" | "failed";
  attemptCount: number;
  maxAttempts: number;
  runAfter: number;
  lastError: string | null;
  updatedAt: number;
  createdAt: number;
};
type SeatSnapshotRow = {
  tenantKey: string;
  connectorId: string;
  guildId: string;
  seatsUsed: number;
  seatLimit: number;
  isOverLimit: boolean;
  status: "fresh" | "stale" | "expired";
  checkedAt: number;
  nextCheckAfter: number;
  lastError: string | null;
  updatedAt: number;
};

type ConnectorWorkspaceProps = {
  tenantKey: string;
  connectorId: string;
  breadcrumbs?: readonly string[];
};

export function ConnectorWorkspace({
  tenantKey,
  connectorId,
  breadcrumbs,
}: ConnectorWorkspaceProps) {
  const hasRouteParams = tenantKey !== "" && connectorId !== "";

  const getConnector = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        ConnectorRow | null
      >("connectors:getConnector"),
    [],
  );
  const listSources = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        SourceRow[]
      >("connectors:listSources"),
    [],
  );
  const listMappings = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        MappingRow[]
      >("connectors:listMappings"),
    [],
  );
  const listGuilds = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        GuildRow[]
      >("discovery:listGuilds"),
    [],
  );
  const listChannels = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string; guildId?: string },
        ChannelRow[]
      >("discovery:listChannels"),
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
  const setStatus = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string; status: "active" | "paused" },
        { ok: true }
      >("connectors:setConnectorStatus"),
    [],
  );
  const setForwardingEnabled = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string; enabled: boolean },
        { ok: true }
      >("connectors:setForwardingEnabled"),
    [],
  );
  const upsertSource = useMemo(
    () =>
      makeFunctionReference<
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
      >("connectors:upsertSource"),
    [],
  );
  const removeSource = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string; channelId: string },
        { ok: true }
      >("connectors:removeSource"),
    [],
  );
  const upsertMapping = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          tenantKey: string;
          connectorId: string;
          sourceChannelId: string;
          targetChannelId: string;
          dashboardEnabled?: boolean;
          minimumTier?: SubscriptionTier;
          priority?: number;
        },
        { ok: true }
      >("connectors:upsertMapping"),
    [],
  );
  const removeMapping = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string; sourceChannelId: string },
        { ok: true }
      >("connectors:removeMapping"),
    [],
  );
  const requestChannelDiscovery = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string; guildId?: string },
        { ok: true; requestVersion: number }
      >("connectors:requestChannelDiscovery"),
    [],
  );
  const getMirrorRuntimeStatus = useMemo(
    () =>
      makeFunctionReference<
        "query",
        Record<string, never>,
        MirrorRuntimeStatusRow
      >("mirror:getSignalMirrorRuntimeStatus"),
    [],
  );
  const getMirrorQueueStats = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        MirrorQueueStatsRow
      >("mirror:getSignalMirrorQueueStats"),
    [],
  );
  const listMirrorJobs = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string; limit?: number },
        MirrorJobRow[]
      >("mirror:listSignalMirrorJobs"),
    [],
  );
  const getMirrorLatencyStats = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string; windowMinutes?: number },
        MirrorLatencyStatsRow
      >("mirror:getSignalMirrorLatencyStats"),
    [],
  );
  const listSeatSnapshotsByConnector = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        SeatSnapshotRow[]
      >("discordSeatAudit:listSeatSnapshotsByConnector"),
    [],
  );

  const connectorArgs = hasRouteParams ? { tenantKey, connectorId } : "skip";
  const connector = useQuery(getConnector, connectorArgs);
  const sources = useQuery(listSources, connectorArgs) ?? [];
  const mappings = useQuery(listMappings, connectorArgs) ?? [];
  const guilds = useQuery(listGuilds, connectorArgs) ?? [];
  const mirrorRuntime = useQuery(getMirrorRuntimeStatus, {});
  const mirrorQueueStats = useQuery(getMirrorQueueStats, connectorArgs);
  const mirrorLatencyStats = useQuery(
    getMirrorLatencyStats,
    hasRouteParams ? { tenantKey, connectorId, windowMinutes: 60 } : "skip",
  );
  const mirrorJobs = useQuery(
    listMirrorJobs,
    hasRouteParams ? { tenantKey, connectorId, limit: 50 } : "skip",
  ) ?? [];
  const seatSnapshots = useQuery(
    listSeatSnapshotsByConnector,
    hasRouteParams ? { tenantKey, connectorId } : "skip",
  ) ?? [];

  const [sourceGuildFilterId, setSourceGuildFilterId] = useState<string>("");
  const [targetGuildFilterId, setTargetGuildFilterId] = useState<string>("");
  const [newSourceGuildId, setNewSourceGuildId] = useState("");
  const [newSourceChannelId, setNewSourceChannelId] = useState("");
  const [newSourceIsSource, setNewSourceIsSource] = useState(true);
  const [newSourceIsTarget, setNewSourceIsTarget] = useState(true);
  const [newSourceThreadMode, setNewSourceThreadMode] = useState("");
  const [newSourceEnabled, setNewSourceEnabled] = useState(true);
  const [editingSourceChannelId, setEditingSourceChannelId] = useState<string | null>(null);
  const [sourceFormMessage, setSourceFormMessage] = useState<string | null>(null);
  const [sourceFormError, setSourceFormError] = useState<string | null>(null);

  const sourceChannelsArgs = !hasRouteParams
    ? "skip"
    : newSourceGuildId
      ? { tenantKey, connectorId, guildId: newSourceGuildId }
      : { tenantKey, connectorId };
  const sourceChannels = useQuery(listChannels, sourceChannelsArgs) ?? [];

  const allChannels = useQuery(listChannels, connectorArgs) ?? [];

  const doRotate = useMutation(rotateConnectorToken);
  const doSetStatus = useMutation(setStatus);
  const doSetForwardingEnabled = useMutation(setForwardingEnabled);
  const doUpsertSource = useMutation(upsertSource);
  const doRemoveSource = useMutation(removeSource);
  const doUpsertMapping = useMutation(upsertMapping);
  const doRemoveMapping = useMutation(removeMapping);
  const doRequestChannelDiscovery = useMutation(requestChannelDiscovery);

  const [lastToken, setLastToken] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isUpdatingForwarding, setIsUpdatingForwarding] = useState(false);
  const [isRequestingChannels, setIsRequestingChannels] = useState(false);
  const [lastDiscoveryRequestVersion, setLastDiscoveryRequestVersion] = useState<number | null>(null);

  const [newMappingSource, setNewMappingSource] = useState("");
  const [newMappingTarget, setNewMappingTarget] = useState("");
  const [newMappingPriority, setNewMappingPriority] = useState<string>("");
  const [newMappingDashboardEnabled, setNewMappingDashboardEnabled] = useState(false);
  const [newMappingMinimumTier, setNewMappingMinimumTier] =
    useState<SubscriptionTier>("basic");
  const [editingMappingSourceChannelId, setEditingMappingSourceChannelId] = useState<string | null>(
    null,
  );
  const [mappingFormMessage, setMappingFormMessage] = useState<string | null>(null);
  const [mappingFormError, setMappingFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!newSourceGuildId || !newSourceChannelId) return;
    if (editingSourceChannelId === newSourceChannelId) return;
    if (!sourceChannels.some((channel) => channel.channelId === newSourceChannelId)) {
      setNewSourceChannelId("");
    }
  }, [newSourceGuildId, newSourceChannelId, sourceChannels, editingSourceChannelId]);

  const guildNameById = useMemo(
    () => new Map(guilds.map((guild) => [guild.guildId, guild.name])),
    [guilds],
  );
  const channelNameById = useMemo(
    () => new Map(allChannels.map((channel) => [channel.channelId, channel.name])),
    [allChannels],
  );
  const guildIdByChannelId = useMemo(
    () => new Map(sources.map((source) => [source.channelId, source.guildId])),
    [sources],
  );

  const availableChannels = useMemo(() => {
    const byChannelId = new Map<
      string,
      { guildId: string; channelId: string; isSource: boolean; isTarget: boolean }
    >();
    for (const source of sources) {
      if (!source.isEnabled) continue;
      if (!source.guildId || !source.channelId) continue;
      byChannelId.set(source.channelId, {
        guildId: source.guildId,
        channelId: source.channelId,
        isSource: source.isSource ?? true,
        isTarget: source.isTarget ?? true,
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
  const mappingTargetOptions = useMemo(() => {
    const scoped = targetGuildFilterId
      ? availableChannels.filter((channel) => channel.guildId === targetGuildFilterId)
      : availableChannels;
    return scoped.filter((channel) => channel.isTarget);
  }, [availableChannels, targetGuildFilterId]);

  useEffect(() => {
    if (editingMappingSourceChannelId && newMappingSource === editingMappingSourceChannelId) return;
    if (newMappingSource && !mappingSourceOptions.some((channel) => channel.channelId === newMappingSource)) {
      setNewMappingSource("");
    }
    if (newMappingTarget && !mappingTargetOptions.some((channel) => channel.channelId === newMappingTarget)) {
      setNewMappingTarget("");
    }
  }, [
    mappingSourceOptions,
    mappingTargetOptions,
    newMappingSource,
    newMappingTarget,
    editingMappingSourceChannelId,
  ]);

  useEffect(() => {
    if (!hasRouteParams) return;
    console.info(
      `[admin/connectors] mapping route split tenant=${tenantKey} connector=${connectorId} source_filter=${sourceGuildFilterId || "all"} target_filter=${targetGuildFilterId || "all"} source_options=${mappingSourceOptions.length} target_options=${mappingTargetOptions.length}`,
    );
  }, [
    hasRouteParams,
    tenantKey,
    connectorId,
    sourceGuildFilterId,
    targetGuildFilterId,
    mappingSourceOptions.length,
    mappingTargetOptions.length,
  ]);

  useEffect(() => {
    if (!mirrorQueueStats || !hasRouteParams) return;
    console.info(
      `[admin/connectors] mirror queue tenant=${tenantKey} connector=${connectorId} pending=${mirrorQueueStats.pending} processing=${mirrorQueueStats.processing} failed=${mirrorQueueStats.failed}`,
    );
  }, [mirrorQueueStats, hasRouteParams, tenantKey, connectorId]);

  useEffect(() => {
    if (!mirrorLatencyStats || !hasRouteParams) return;
    console.info(
      `[admin/connectors] mirror latency tenant=${tenantKey} connector=${connectorId} window_min=${mirrorLatencyStats.windowMinutes} create_p95_ms=${mirrorLatencyStats.create.p95Ms ?? -1} update_p95_ms=${mirrorLatencyStats.update.p95Ms ?? -1} delete_p95_ms=${mirrorLatencyStats.delete.p95Ms ?? -1}`,
    );
  }, [mirrorLatencyStats, hasRouteParams, tenantKey, connectorId]);

  useEffect(() => {
    if (!hasRouteParams || seatSnapshots.length === 0) return;
    const overLimitCount = seatSnapshots.filter((snapshot) => snapshot.isOverLimit).length;
    console.info(
      `[admin/connectors] seat snapshot tenant=${tenantKey} connector=${connectorId} servers=${seatSnapshots.length} over_limit=${overLimitCount}`,
    );
  }, [seatSnapshots, hasRouteParams, tenantKey, connectorId]);

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

  function renderLatency(value: number | null) {
    if (value === null) return "n/a";
    return `${Math.round(value)}ms`;
  }

  function formatDateTime(value: number | null | undefined) {
    if (!value) return "n/a";
    return new Date(value).toLocaleString();
  }

  function resetSourceForm() {
    setEditingSourceChannelId(null);
    setNewSourceGuildId("");
    setNewSourceChannelId("");
    setNewSourceIsSource(true);
    setNewSourceIsTarget(true);
    setNewSourceThreadMode("");
    setNewSourceEnabled(true);
  }

  function startEditSource(source: SourceRow) {
    setEditingSourceChannelId(source.channelId);
    setNewSourceGuildId(source.guildId);
    setNewSourceChannelId(source.channelId);
    setNewSourceIsSource(source.isSource ?? true);
    setNewSourceIsTarget(source.isTarget ?? true);
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

  function resetMappingForm() {
    setEditingMappingSourceChannelId(null);
    setNewMappingSource("");
    setNewMappingTarget("");
    setNewMappingPriority("");
    setNewMappingDashboardEnabled(false);
    setNewMappingMinimumTier("basic");
  }

  function startEditMapping(mapping: MappingRow) {
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
    setMappingFormMessage(null);
    setMappingFormError(null);
  }

  function cancelEditMapping() {
    resetMappingForm();
    setMappingFormMessage(null);
    setMappingFormError(null);
  }

  function renderJobStatusBadge(status: MirrorJobRow["status"]) {
    if (status === "completed") {
      return (
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
          completed
        </span>
      );
    }
    if (status === "failed") {
      return (
        <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">
          failed
        </span>
      );
    }
    if (status === "processing") {
      return (
        <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
          processing
        </span>
      );
    }
    return (
      <span className="rounded-full border border-slate-500/30 bg-slate-500/20 px-2 py-0.5 text-xs font-semibold text-slate-200">
        pending
      </span>
    );
  }

  async function onRotate() {
    if (!hasRouteParams) return;
    setIsRotating(true);
    setLastToken(null);
    try {
      const res = await doRotate({ tenantKey, connectorId });
      setLastToken(res.token);
    } finally {
      setIsRotating(false);
    }
  }

  async function onToggleStatus() {
    if (!hasRouteParams || !connector) return;
    const next = connector.status === "active" ? "paused" : "active";
    await doSetStatus({ tenantKey, connectorId, status: next });
  }

  async function onToggleForwarding() {
    if (!hasRouteParams || !connector) return;
    const next = !(connector.forwardEnabled === true);
    setIsUpdatingForwarding(true);
    try {
      await doSetForwardingEnabled({
        tenantKey,
        connectorId,
        enabled: next,
      });
      console.info(
        `[admin/connectors] forwarding updated tenant=${tenantKey} connector=${connectorId} enabled=${next}`,
      );
    } finally {
      setIsUpdatingForwarding(false);
    }
  }

  async function onSubmitSource() {
    if (!hasRouteParams || !newSourceGuildId || !newSourceChannelId) return;
    if (!newSourceIsSource && !newSourceIsTarget) return;
    setSourceFormMessage(null);
    setSourceFormError(null);
    try {
      await doUpsertSource({
        tenantKey,
        connectorId,
        guildId: newSourceGuildId,
        channelId: newSourceChannelId,
        isSource: newSourceIsSource,
        isTarget: newSourceIsTarget,
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
      console.info(
        `[admin/connectors] source upsert tenant=${tenantKey} connector=${connectorId} channel=${newSourceChannelId} source=${newSourceIsSource} target=${newSourceIsTarget} enabled=${newSourceEnabled}`,
      );
      if (editingSourceChannelId) {
        setEditingSourceChannelId(null);
      } else {
        resetSourceForm();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to save available channel";
      setSourceFormError(text);
      console.error(`[admin/connectors] source upsert failed: ${text}`);
    }
  }

  async function onSubmitMapping() {
    if (!hasRouteParams || !newMappingSource || !newMappingTarget) return;
    setMappingFormMessage(null);
    setMappingFormError(null);
    const prio =
      newMappingPriority.trim() === ""
        ? undefined
        : Number(newMappingPriority.trim());
    try {
      await doUpsertMapping({
        tenantKey,
        connectorId,
        sourceChannelId: newMappingSource,
        targetChannelId: newMappingTarget,
        dashboardEnabled: newMappingDashboardEnabled,
        minimumTier: newMappingDashboardEnabled ? newMappingMinimumTier : undefined,
        priority: Number.isFinite(prio) ? prio : undefined,
      });
      if (
        editingMappingSourceChannelId &&
        editingMappingSourceChannelId !== newMappingSource
      ) {
        await doRemoveMapping({
          tenantKey,
          connectorId,
          sourceChannelId: editingMappingSourceChannelId,
        });
      }
      setMappingFormMessage(
        editingMappingSourceChannelId
          ? `Updated mapping ${renderChannelLabel(newMappingSource)} -> ${renderChannelLabel(newMappingTarget)}.`
          : `Added mapping ${renderChannelLabel(newMappingSource)} -> ${renderChannelLabel(newMappingTarget)}.`,
      );
      console.info(
        `[admin/connectors] mapping upsert tenant=${tenantKey} connector=${connectorId} source=${newMappingSource} target=${newMappingTarget} dashboard_enabled=${newMappingDashboardEnabled} minimum_tier=${newMappingDashboardEnabled ? newMappingMinimumTier : "none"} priority=${Number.isFinite(prio) ? prio : -1}`,
      );
      resetMappingForm();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to save mapping";
      setMappingFormError(text);
      console.error(`[admin/connectors] mapping upsert failed: ${text}`);
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Mappings"
        title={`${tenantKey || "unknown"} / ${connectorId || "unknown"}`}
        description="Runtime config, bot mirroring controls, and token management."
        breadcrumbs={breadcrumbs}
        actions={
          <>
            <Link href="/mappings" className="admin-link">
              Back to mappings
            </Link>
            <Link href="/discord-bot" className="admin-link">
              Discord Bot
            </Link>
            <Link href="/shop/policies" className="admin-link">
              Shop policies
            </Link>
          </>
        }
      />

      {!hasRouteParams ? (
        <AdminSectionCard>
          <p className="text-sm text-rose-400">
            Missing connector route params. Open this page from the connectors list.
          </p>
        </AdminSectionCard>
      ) : connector === undefined ? (
        <AdminSectionCard>
          <p className="text-sm text-slate-400">Loading connector...</p>
        </AdminSectionCard>
      ) : connector === null ? (
        <AdminSectionCard>
          <p className="text-sm text-rose-400">
            Connector not found for this tenant/key pair.
          </p>
        </AdminSectionCard>
      ) : (
        <AdminSectionCard>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200">
              status: {connector.status}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200">
              mirroring: {connector.forwardEnabled === true ? "enabled" : "disabled"}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200">
              config: v{connector.configVersion}
            </span>
            <button
              type="button"
              onClick={onToggleStatus}
              className="admin-btn-secondary"
            >
              Toggle status
            </button>
            <button
              type="button"
              onClick={onRotate}
              disabled={isRotating}
              className="admin-btn-secondary"
            >
              {isRotating ? "Rotating..." : "Rotate token"}
            </button>
            <button
              type="button"
              onClick={onToggleForwarding}
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
      )}

      {lastToken ? (
        <AdminSectionCard title="Connector token">
          <p className="text-xs font-medium text-slate-300">Shown once after rotation:</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
            {lastToken}
          </pre>
        </AdminSectionCard>
      ) : null}

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
          <p className="mt-2">
            Queue stats: pending <strong>{mirrorQueueStats?.pending ?? 0}</strong> (ready{" "}
            <strong>{mirrorQueueStats?.pendingReady ?? 0}</strong>), processing{" "}
            <strong>{mirrorQueueStats?.processing ?? 0}</strong>, failed{" "}
            <strong>{mirrorQueueStats?.failed ?? 0}</strong>, total{" "}
            <strong>{mirrorQueueStats?.total ?? 0}</strong>.
          </p>
          <p className="mt-2">
            Latency (last {mirrorLatencyStats?.windowMinutes ?? 60}m): create p95{" "}
            <strong>{renderLatency(mirrorLatencyStats?.create.p95Ms ?? null)}</strong> (n=
            <strong>{mirrorLatencyStats?.create.count ?? 0}</strong>), update p95{" "}
            <strong>{renderLatency(mirrorLatencyStats?.update.p95Ms ?? null)}</strong> (n=
            <strong>{mirrorLatencyStats?.update.count ?? 0}</strong>), delete p95{" "}
            <strong>{renderLatency(mirrorLatencyStats?.delete.p95Ms ?? null)}</strong> (n=
            <strong>{mirrorLatencyStats?.delete.count ?? 0}</strong>).
          </p>
        </div>
      </AdminSectionCard>

      <AdminSectionCard title="Seat enforcement status by guild">
        {seatSnapshots.length === 0 ? (
          <p className="text-xs text-slate-400">
            No seat snapshots yet. Configure seat enforcement in{" "}
            <Link href="/discord-bot" className="admin-link">
              Discord Bot
            </Link>{" "}
            and request a refresh.
          </p>
        ) : (
          <div className="overflow-x-auto">
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
                {seatSnapshots.map((snapshot) => (
                  <tr key={`${snapshot.tenantKey}:${snapshot.connectorId}:${snapshot.guildId}`}>
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
                    <td className="px-3 py-2">{formatDateTime(snapshot.checkedAt)}</td>
                    <td className="px-3 py-2">{snapshot.lastError ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionCard>

      <div className="space-y-8">
        <div>
          <AdminSectionCard title="Channel Registry (Plugin Source + Bot Target)">
            <div className="admin-surface-soft">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="admin-label">
                  Guild (plugin-discovered)
                  <select
                    className="admin-input"
                    value={newSourceGuildId}
                    onChange={(e) => setNewSourceGuildId(e.target.value)}
                  >
                    <option value="">Select guild</option>
                    {guilds.map((g) => (
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
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    checked={newSourceIsSource}
                    onChange={(e) => setNewSourceIsSource(e.target.checked)}
                  />
                  Source
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    checked={newSourceIsTarget}
                    onChange={(e) => setNewSourceIsTarget(e.target.checked)}
                  />
                  Target
                </label>
                <button
                  type="button"
                  onClick={onRequestChannels}
                  disabled={!newSourceGuildId || isRequestingChannels}
                  className="admin-btn-secondary"
                >
                  {isRequestingChannels ? "Requesting..." : "Fetch channels"}
                </button>
                <button type="button" onClick={onSubmitSource} className="admin-btn-primary">
                  {editingSourceChannelId ? "Save source" : "Add source"}
                </button>
                {editingSourceChannelId ? (
                  <button type="button" onClick={cancelEditSource} className="admin-btn-secondary">
                    Cancel
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Guilds sync automatically from the plugin. Select a guild, click{" "}
                <strong>Fetch channels</strong>, pick a channel, and save it as available.
                Mark whether the channel is usable as a source, target, or both.
                Source=true means plugin ingest can read this channel.
                Target=true means bot mirror mappings can route into this channel.
                {lastDiscoveryRequestVersion
                  ? ` Last fetch request: v${lastDiscoveryRequestVersion}.`
                  : ""}
                {editingSourceChannelId
                  ? " While editing, channel ID is locked to preserve mapping references."
                  : ""}
              </p>
              {sourceFormMessage ? <p className="mt-3 text-sm text-emerald-400">{sourceFormMessage}</p> : null}
              {sourceFormError ? <p className="mt-3 text-sm text-rose-400">{sourceFormError}</p> : null}
            </div>
          </AdminSectionCard>

          <AdminTableShell
            title="Configured channel registry"
            isEmpty={sources.length === 0}
            emptyMessage="No available channels yet."
            tableClassName="overflow-x-auto"
          >
            <table className="w-full table-auto text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 text-xs font-semibold text-slate-300">
                <tr>
                  <th className="px-3 py-2">Plugin guild</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Thread</th>
                  <th className="px-3 py-2">Enabled</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Target</th>
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
                    <td className="px-3 py-2">{(s.isSource ?? true) ? "yes" : "no"}</td>
                    <td className="px-3 py-2">{(s.isTarget ?? true) ? "yes" : "no"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditSource(s)}
                          className="text-sm font-medium text-cyan-300 underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await doRemoveSource({
                                tenantKey,
                                connectorId,
                                channelId: s.channelId,
                              });
                              if (editingSourceChannelId === s.channelId) {
                                cancelEditSource();
                              }
                              setSourceFormMessage(`Removed available channel ${renderChannelLabel(s.channelId)}.`);
                            } catch (error) {
                              const text =
                                error instanceof Error ? error.message : "Failed to remove available channel";
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
        </div>

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
                    {guilds.map((g) => (
                      <option key={`src-guild-${g._id}`} value={g.guildId}>
                        {g.name} ({g.guildId})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-label">
                  Target guild filter (bot)
                  <select
                    className="admin-input mt-1"
                    value={targetGuildFilterId}
                    onChange={(e) => setTargetGuildFilterId(e.target.value)}
                  >
                    <option value="">All target guilds</option>
                    {guilds.map((g) => (
                      <option key={`dst-guild-${g._id}`} value={g.guildId}>
                        {g.name} ({g.guildId})
                      </option>
                    ))}
                  </select>
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
                  Target channel (bot mirror)
                  <select
                    className="admin-input"
                    value={newMappingTarget}
                    onChange={(e) => setNewMappingTarget(e.target.value)}
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
                  Add enabled available channels on the left before creating mappings.
                </p>
              ) : mappingSourceOptions.length === 0 || mappingTargetOptions.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">
                  Mark at least one channel as source and one as target to create routes.
                </p>
              ) : null}
              <p className="mt-3 text-xs text-slate-400">
                These routes define how plugin source channels map to bot target channels.
                Dashboard visibility is hidden by default until explicitly enabled with a minimum tier.
                {editingMappingSourceChannelId
                  ? " Editing keeps this row in place and updates it directly."
                  : ""}
              </p>

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
                    onChange={(e) =>
                      setNewMappingMinimumTier(e.target.value as SubscriptionTier)
                    }
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
                <button type="button" onClick={onSubmitMapping} className="admin-btn-primary">
                  {editingMappingSourceChannelId ? "Save mapping" : "Add mapping"}
                </button>
                {editingMappingSourceChannelId ? (
                  <button type="button" onClick={cancelEditMapping} className="admin-btn-secondary">
                    Cancel
                  </button>
                ) : null}
              </div>
              {mappingFormMessage ? <p className="mt-3 text-sm text-emerald-400">{mappingFormMessage}</p> : null}
              {mappingFormError ? <p className="mt-3 text-sm text-rose-400">{mappingFormError}</p> : null}
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
                  <th className="px-3 py-2">Dashboard</th>
                  <th className="px-3 py-2">Min tier</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
                {mappings.map((m) => (
                  <tr key={m._id}>
                    <td className="px-3 py-2 align-top break-all">{renderChannelRouteLabel(m.sourceChannelId)}</td>
                    <td className="px-3 py-2 align-top break-all">{renderChannelRouteLabel(m.targetChannelId)}</td>
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
                                `Removed mapping ${renderChannelLabel(m.sourceChannelId)} -> ${renderChannelLabel(m.targetChannelId)}.`,
                              );
                            } catch (error) {
                              const text = error instanceof Error ? error.message : "Failed to remove mapping";
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
                ))}
              </tbody>
            </table>
          </AdminTableShell>

          <AdminTableShell
            title="Recent Mirror Jobs"
            isEmpty={mirrorJobs.length === 0}
            emptyMessage="No mirror jobs yet."
            tableClassName="overflow-x-auto"
          >
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 text-xs font-semibold text-slate-300">
                <tr>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Attempts</th>
                  <th className="px-3 py-2">Run after</th>
                  <th className="px-3 py-2">Last error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
                {mirrorJobs.map((job) => (
                  <tr key={job.jobId}>
                    <td className="px-3 py-2 text-xs text-slate-300">{formatDateTime(job.updatedAt)}</td>
                    <td className="px-3 py-2 uppercase tracking-wide text-slate-200">{job.eventType}</td>
                    <td className="px-3 py-2">
                      <p className="text-xs text-slate-100">{renderChannelLabel(job.sourceChannelId)}</p>
                      <p className="text-xs text-slate-400">to {renderChannelLabel(job.targetChannelId)}</p>
                    </td>
                    <td className="px-3 py-2">{renderJobStatusBadge(job.status)}</td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {job.attemptCount}/{job.maxAttempts}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">{formatDateTime(job.runAfter)}</td>
                    <td className="px-3 py-2 text-xs">
                      {job.lastError ? (
                        <span className="text-rose-300">{job.lastError}</span>
                      ) : (
                        <span className="text-slate-500">none</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        </div>
      </div>
    </div>
  );
}

