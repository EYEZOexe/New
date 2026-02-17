"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

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

function decodeParam(value: string | string[] | undefined) {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ConnectorDetailPage() {
  const params = useParams<{ tenantKey?: string | string[]; connectorId?: string | string[] }>();
  const tenantKey = decodeParam(params.tenantKey);
  const connectorId = decodeParam(params.connectorId);
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
    hasRouteParams ? { tenantKey, connectorId, limit: 10 } : "skip",
  ) ?? [];

  const [guildIdFilter, setGuildIdFilter] = useState<string>("");
  const [newSourceGuildId, setNewSourceGuildId] = useState("");
  const [newSourceChannelId, setNewSourceChannelId] = useState("");
  const [newSourceIsSource, setNewSourceIsSource] = useState(true);
  const [newSourceIsTarget, setNewSourceIsTarget] = useState(true);
  const [newSourceThreadMode, setNewSourceThreadMode] = useState("");
  const [newSourceEnabled, setNewSourceEnabled] = useState(true);

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

  useEffect(() => {
    if (!newSourceGuildId || !newSourceChannelId) return;
    if (!sourceChannels.some((channel) => channel.channelId === newSourceChannelId)) {
      setNewSourceChannelId("");
    }
  }, [newSourceGuildId, newSourceChannelId, sourceChannels]);

  const guildNameById = useMemo(
    () => new Map(guilds.map((guild) => [guild.guildId, guild.name])),
    [guilds],
  );
  const channelNameById = useMemo(
    () => new Map(allChannels.map((channel) => [channel.channelId, channel.name])),
    [allChannels],
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

  const mappingChannelOptions = useMemo(() => {
    if (!guildIdFilter) return availableChannels;
    return availableChannels.filter((channel) => channel.guildId === guildIdFilter);
  }, [availableChannels, guildIdFilter]);

  const mappingSourceOptions = useMemo(
    () => mappingChannelOptions.filter((channel) => channel.isSource),
    [mappingChannelOptions],
  );
  const mappingTargetOptions = useMemo(
    () => mappingChannelOptions.filter((channel) => channel.isTarget),
    [mappingChannelOptions],
  );

  useEffect(() => {
    if (newMappingSource && !mappingSourceOptions.some((channel) => channel.channelId === newMappingSource)) {
      setNewMappingSource("");
    }
    if (newMappingTarget && !mappingTargetOptions.some((channel) => channel.channelId === newMappingTarget)) {
      setNewMappingTarget("");
    }
  }, [mappingSourceOptions, mappingTargetOptions, newMappingSource, newMappingTarget]);

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

  function renderGuildLabel(guildId: string) {
    return `${guildNameById.get(guildId) ?? "Unknown guild"} (${guildId})`;
  }

  function renderChannelLabel(channelId: string) {
    return `${channelNameById.get(channelId) ?? "Unknown channel"} (${channelId})`;
  }

  function renderLatency(value: number | null) {
    if (value === null) return "n/a";
    return `${Math.round(value)}ms`;
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

  async function onAddSource() {
    if (!hasRouteParams || !newSourceGuildId || !newSourceChannelId) return;
    if (!newSourceIsSource && !newSourceIsTarget) return;
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
  }

  async function onAddMapping() {
    if (!hasRouteParams || !newMappingSource || !newMappingTarget) return;
    const prio =
      newMappingPriority.trim() === ""
        ? undefined
        : Number(newMappingPriority.trim());
    await doUpsertMapping({
      tenantKey,
      connectorId,
      sourceChannelId: newMappingSource,
      targetChannelId: newMappingTarget,
      dashboardEnabled: newMappingDashboardEnabled,
      minimumTier: newMappingDashboardEnabled ? newMappingMinimumTier : undefined,
      priority: Number.isFinite(prio) ? prio : undefined,
    });
    console.info(
      `[admin/connectors] mapping updated tenant=${tenantKey} connector=${connectorId} source=${newMappingSource} target=${newMappingTarget} dashboard_enabled=${newMappingDashboardEnabled} minimum_tier=${newMappingDashboardEnabled ? newMappingMinimumTier : "none"}`,
    );
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
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <section className="mx-auto w-full max-w-6xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {tenantKey || "unknown"} / {connectorId || "unknown"}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Runtime config, bot mirroring controls, and token management.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/connectors"
              className="text-sm font-medium text-zinc-900 underline"
            >
              Back to connectors
            </Link>
            <Link
              href="/discord"
              className="text-sm font-medium text-zinc-900 underline"
            >
              Discord roles
            </Link>
            <Link
              href="/payments/policies"
              className="text-sm font-medium text-zinc-900 underline"
            >
              Access policies
            </Link>
          </div>
        </div>

        {!hasRouteParams ? (
          <p className="mt-6 text-sm text-red-700">
            Missing connector route params. Open this page from the connectors list.
          </p>
        ) : connector === undefined ? (
          <p className="mt-6 text-sm text-zinc-600">Loading connector...</p>
        ) : connector === null ? (
          <p className="mt-6 text-sm text-red-700">
            Connector not found for this tenant/key pair.
          </p>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">
              status: {connector.status}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">
              mirroring: {connector.forwardEnabled === true ? "enabled" : "disabled"}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">
              config: v{connector.configVersion}
            </span>
            <button
              type="button"
              onClick={onToggleStatus}
              className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium"
            >
              Toggle status
            </button>
            <button
              type="button"
              onClick={onRotate}
              disabled={isRotating}
              className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
            >
              {isRotating ? "Rotating..." : "Rotate token"}
            </button>
            <button
              type="button"
              onClick={onToggleForwarding}
              disabled={isUpdatingForwarding}
              className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
            >
              {isUpdatingForwarding
                ? "Updating..."
                : connector.forwardEnabled === true
                  ? "Disable mirroring"
                  : "Enable mirroring"}
            </button>
          </div>
        )}

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

        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
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

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Available Channels</h2>

            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Guild
                  <select
                    className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Channel
                  <select
                    className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                    value={newSourceChannelId}
                    onChange={(e) => setNewSourceChannelId(e.target.value)}
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
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Thread mode
                  <select
                    className="h-9 w-40 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                    value={newSourceThreadMode}
                    onChange={(e) => setNewSourceThreadMode(e.target.value)}
                  >
                    <option value="">default</option>
                    <option value="include">include</option>
                    <option value="exclude">exclude</option>
                    <option value="only">only</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={newSourceEnabled}
                    onChange={(e) => setNewSourceEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={newSourceIsSource}
                    onChange={(e) => setNewSourceIsSource(e.target.checked)}
                  />
                  Source
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
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
                  className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
                >
                  {isRequestingChannels ? "Requesting..." : "Fetch channels"}
                </button>
                <button
                  type="button"
                  onClick={onAddSource}
                  className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium"
                >
                  Add / update available
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-600">
                Guilds sync automatically from the plugin. Select a guild, click{" "}
                <strong>Fetch channels</strong>, pick a channel, and save it as available.
                Mark whether the channel is usable as a source, target, or both.
                {lastDiscoveryRequestVersion
                  ? ` Last fetch request: v${lastDiscoveryRequestVersion}.`
                  : ""}
              </p>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-700">
                  <tr>
                    <th className="px-3 py-2">Guild</th>
                    <th className="px-3 py-2">Available Channel</th>
                    <th className="px-3 py-2">Thread</th>
                    <th className="px-3 py-2">Enabled</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s._id} className="border-t border-zinc-200">
                      <td className="px-3 py-2">{renderGuildLabel(s.guildId)}</td>
                      <td className="px-3 py-2">{renderChannelLabel(s.channelId)}</td>
                      <td className="px-3 py-2">{s.threadMode ?? "-"}</td>
                      <td className="px-3 py-2">{s.isEnabled ? "yes" : "no"}</td>
                      <td className="px-3 py-2">{(s.isSource ?? true) ? "yes" : "no"}</td>
                      <td className="px-3 py-2">{(s.isTarget ?? true) ? "yes" : "no"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            doRemoveSource({
                              tenantKey,
                              connectorId,
                              channelId: s.channelId,
                            })
                          }
                          className="text-sm font-medium underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sources.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-3 text-sm text-zinc-600"
                        colSpan={7}
                      >
                        No available channels yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Mirror Mappings</h2>

            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                Filter available channels by guild (optional)
                <select
                  className="mt-1 h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={guildIdFilter}
                  onChange={(e) => setGuildIdFilter(e.target.value)}
                >
                  <option value="">All guilds</option>
                  {guilds.map((g) => (
                    <option key={g._id} value={g.guildId}>
                      {g.name} ({g.guildId})
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Source (available channel)
                  <select
                    className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                    value={newMappingSource}
                    onChange={(e) => setNewMappingSource(e.target.value)}
                  >
                    <option value="">Select source</option>
                    {mappingSourceOptions.map((channel) => (
                      <option key={`src-${channel.channelId}`} value={channel.channelId}>
                        {renderChannelLabel(channel.channelId)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Target (available channel)
                  <select
                    className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                    value={newMappingTarget}
                    onChange={(e) => setNewMappingTarget(e.target.value)}
                  >
                    <option value="">Select target</option>
                    {mappingTargetOptions.map((channel) => (
                      <option key={`dst-${channel.channelId}`} value={channel.channelId}>
                        {renderChannelLabel(channel.channelId)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {availableChannels.length === 0 ? (
                <p className="mt-3 text-xs text-zinc-600">
                  Add enabled available channels on the left before creating mappings.
                </p>
              ) : mappingSourceOptions.length === 0 || mappingTargetOptions.length === 0 ? (
                <p className="mt-3 text-xs text-zinc-600">
                  Mark at least one available channel as source and one as target to create mappings.
                </p>
              ) : null}
              <p className="mt-3 text-xs text-zinc-600">
                These mappings define which target channels the bot mirrors to when connector mirroring is enabled.
                Dashboard visibility is hidden by default until explicitly enabled with a minimum tier.
              </p>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={newMappingDashboardEnabled}
                    onChange={(e) => setNewMappingDashboardEnabled(e.target.checked)}
                  />
                  Visible on dashboard
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Minimum tier
                  <select
                    className="h-9 w-36 rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Priority
                  <input
                    value={newMappingPriority}
                    onChange={(e) => setNewMappingPriority(e.target.value)}
                    className="h-9 w-32 rounded-md border border-zinc-300 px-3 text-sm"
                    placeholder="(optional)"
                  />
                </label>
                <button
                  type="button"
                  onClick={onAddMapping}
                  className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium"
                >
                  Add / update
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-700">
                  <tr>
                    <th className="px-3 py-2">Source (available)</th>
                    <th className="px-3 py-2">Target (available)</th>
                    <th className="px-3 py-2">Dashboard</th>
                    <th className="px-3 py-2">Min tier</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m._id} className="border-t border-zinc-200">
                      <td className="px-3 py-2">{renderChannelLabel(m.sourceChannelId)}</td>
                      <td className="px-3 py-2">{renderChannelLabel(m.targetChannelId)}</td>
                      <td className="px-3 py-2">
                        {m.dashboardEnabled === true ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            visible
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                            hidden
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{m.minimumTier ?? "-"}</td>
                      <td className="px-3 py-2">{m.priority ?? "-"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            doRemoveMapping({
                              tenantKey,
                              connectorId,
                              sourceChannelId: m.sourceChannelId,
                            })
                          }
                          className="text-sm font-medium underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {mappings.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-3 text-sm text-zinc-600"
                        colSpan={6}
                      >
                        No mappings yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                Recent Mirror Jobs
              </h3>
              <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-semibold text-zinc-700">
                    <tr>
                      <th className="px-3 py-2">Event</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Target</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mirrorJobs.map((job) => (
                      <tr key={job.jobId} className="border-t border-zinc-200">
                        <td className="px-3 py-2">{job.eventType}</td>
                        <td className="px-3 py-2">{renderChannelLabel(job.sourceChannelId)}</td>
                        <td className="px-3 py-2">{renderChannelLabel(job.targetChannelId)}</td>
                        <td className="px-3 py-2">
                          {job.status}
                          {job.lastError ? ` (${job.lastError})` : ""}
                        </td>
                        <td className="px-3 py-2">
                          {job.attemptCount}/{job.maxAttempts}
                        </td>
                      </tr>
                    ))}
                    {mirrorJobs.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-sm text-zinc-600" colSpan={5}>
                          No mirror jobs yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

