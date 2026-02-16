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

type SourceRow = {
  _id: string;
  guildId: string;
  channelId: string;
  threadMode?: "include" | "exclude" | "only";
  isEnabled: boolean;
};

type MappingRow = {
  _id: string;
  sourceChannelId: string;
  targetChannelId: string;
  priority?: number;
};

type GuildRow = { _id: string; guildId: string; name: string };
type ChannelRow = { _id: string; channelId: string; guildId: string; name: string };

export default function ConnectorDetailPage({
  params,
}: {
  params: { tenantKey: string; connectorId: string };
}) {
  const tenantKey = decodeURIComponent(params.tenantKey);
  const connectorId = decodeURIComponent(params.connectorId);

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
  const upsertSource = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          tenantKey: string;
          connectorId: string;
          guildId: string;
          channelId: string;
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

  const connector = useQuery(getConnector, { tenantKey, connectorId });
  const sources = useQuery(listSources, { tenantKey, connectorId }) ?? [];
  const mappings = useQuery(listMappings, { tenantKey, connectorId }) ?? [];
  const guilds = useQuery(listGuilds, { tenantKey, connectorId }) ?? [];

  const [guildIdFilter, setGuildIdFilter] = useState<string>("");
  const channels =
    useQuery(
      listChannels,
      guildIdFilter
        ? { tenantKey, connectorId, guildId: guildIdFilter }
        : { tenantKey, connectorId },
    ) ?? [];

  const doRotate = useMutation(rotateConnectorToken);
  const doSetStatus = useMutation(setStatus);
  const doUpsertSource = useMutation(upsertSource);
  const doRemoveSource = useMutation(removeSource);
  const doUpsertMapping = useMutation(upsertMapping);
  const doRemoveMapping = useMutation(removeMapping);

  const [lastToken, setLastToken] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  const [newSourceGuildId, setNewSourceGuildId] = useState("");
  const [newSourceChannelId, setNewSourceChannelId] = useState("");
  const [newSourceThreadMode, setNewSourceThreadMode] = useState("");
  const [newSourceEnabled, setNewSourceEnabled] = useState(true);

  const [newMappingSource, setNewMappingSource] = useState("");
  const [newMappingTarget, setNewMappingTarget] = useState("");
  const [newMappingPriority, setNewMappingPriority] = useState<string>("");

  async function onRotate() {
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
    if (!connector) return;
    const next = connector.status === "active" ? "paused" : "active";
    await doSetStatus({ tenantKey, connectorId, status: next });
  }

  async function onAddSource() {
    if (!newSourceGuildId || !newSourceChannelId) return;
    await doUpsertSource({
      tenantKey,
      connectorId,
      guildId: newSourceGuildId,
      channelId: newSourceChannelId,
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
    if (!newMappingSource || !newMappingTarget) return;
    const prio =
      newMappingPriority.trim() === ""
        ? undefined
        : Number(newMappingPriority.trim());
    await doUpsertMapping({
      tenantKey,
      connectorId,
      sourceChannelId: newMappingSource,
      targetChannelId: newMappingTarget,
      priority: Number.isFinite(prio) ? prio : undefined,
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <section className="mx-auto w-full max-w-6xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {tenantKey} / {connectorId}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Runtime config and token management.
            </p>
          </div>

          <Link
            href="/connectors"
            className="text-sm font-medium text-zinc-900 underline"
          >
            Back to connectors
          </Link>
        </div>

        {!connector ? (
          <p className="mt-6 text-sm text-zinc-600">Loading connector...</p>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">
              status: {connector.status}
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

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Sources</h2>

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
                    {channels
                      .filter((c) =>
                        newSourceGuildId ? c.guildId === newSourceGuildId : true,
                      )
                      .map((c) => (
                        <option key={c._id} value={c.channelId}>
                          {c.name} ({c.channelId})
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
                <button
                  type="button"
                  onClick={onAddSource}
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
                    <th className="px-3 py-2">Guild</th>
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2">Thread</th>
                    <th className="px-3 py-2">Enabled</th>
                    <th className="px-3 py-2">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s._id} className="border-t border-zinc-200">
                      <td className="px-3 py-2">{s.guildId}</td>
                      <td className="px-3 py-2">{s.channelId}</td>
                      <td className="px-3 py-2">{s.threadMode ?? "-"}</td>
                      <td className="px-3 py-2">{s.isEnabled ? "yes" : "no"}</td>
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
                        colSpan={5}
                      >
                        No sources yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Mappings</h2>

            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                Filter channels by guild (optional)
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
                  Source channel
                  <select
                    className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                    value={newMappingSource}
                    onChange={(e) => setNewMappingSource(e.target.value)}
                  >
                    <option value="">Select source</option>
                    {channels.map((c) => (
                      <option key={c._id} value={c.channelId}>
                        {c.name} ({c.channelId})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Target channel
                  <select
                    className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                    value={newMappingTarget}
                    onChange={(e) => setNewMappingTarget(e.target.value)}
                  >
                    <option value="">Select target</option>
                    {channels.map((c) => (
                      <option key={c._id} value={c.channelId}>
                        {c.name} ({c.channelId})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
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
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m._id} className="border-t border-zinc-200">
                      <td className="px-3 py-2">{m.sourceChannelId}</td>
                      <td className="px-3 py-2">{m.targetChannelId}</td>
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
                        colSpan={4}
                      >
                        No mappings yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

