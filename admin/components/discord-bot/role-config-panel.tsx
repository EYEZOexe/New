"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";

type SubscriptionTier = "basic" | "advanced" | "pro";
const TIERS: SubscriptionTier[] = ["basic", "advanced", "pro"];

type TierRoleMappingRow = {
  tier: SubscriptionTier;
  guildId: string;
  roleId: string;
  enabled: boolean;
  updatedAt: number | null;
};

type RuntimeStatusRow = {
  hasRoleSyncBotToken: boolean;
  legacyFallbackConfigured: boolean;
  legacyGuildId: string | null;
  legacyRoleId: string | null;
};

type ConnectorRow = {
  _id: string;
  tenantKey: string;
  connectorId: string;
  status: "active" | "paused";
};

type GuildRow = {
  _id: string;
  guildId: string;
  name: string;
};

type ServerConfigRow = {
  tenantKey: string;
  connectorId: string;
  guildId: string;
  seatLimit: number;
  seatEnforcementEnabled: boolean;
  basicRoleId: string | null;
  advancedRoleId: string | null;
  proRoleId: string | null;
  updatedAt: number;
  createdAt: number;
};

type ServerSeatSnapshotRow = {
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

type DraftRow = {
  guildId: string;
  roleId: string;
  enabled: boolean;
};

function toDraftState(rows: TierRoleMappingRow[]): Record<SubscriptionTier, DraftRow> {
  const map = new Map(rows.map((row) => [row.tier, row]));
  return {
    basic: {
      guildId: map.get("basic")?.guildId ?? "",
      roleId: map.get("basic")?.roleId ?? "",
      enabled: map.get("basic")?.enabled ?? false,
    },
    advanced: {
      guildId: map.get("advanced")?.guildId ?? "",
      roleId: map.get("advanced")?.roleId ?? "",
      enabled: map.get("advanced")?.enabled ?? false,
    },
    pro: {
      guildId: map.get("pro")?.guildId ?? "",
      roleId: map.get("pro")?.roleId ?? "",
      enabled: map.get("pro")?.enabled ?? false,
    },
  };
}

type RoleConfigPanelProps = {
  breadcrumbs?: readonly string[];
};

export function RoleConfigPanel({ breadcrumbs }: RoleConfigPanelProps) {
  const listTierRoleMappingsRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, TierRoleMappingRow[]>(
        "discordRoleConfig:listTierRoleMappings",
      ),
    [],
  );
  const upsertTierRoleMappingRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          tier: SubscriptionTier;
          guildId: string;
          roleId: string;
          enabled: boolean;
        },
        { ok: true }
      >("discordRoleConfig:upsertTierRoleMapping"),
    [],
  );
  const removeTierRoleMappingRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tier: SubscriptionTier },
        { ok: true; removed: boolean }
      >("discordRoleConfig:removeTierRoleMapping"),
    [],
  );
  const runtimeStatusRef = useMemo(
    () =>
      makeFunctionReference<"query", Record<string, never>, RuntimeStatusRow>(
        "discordRoleConfig:getRoleSyncRuntimeStatus",
      ),
    [],
  );
  const listConnectorsRef = useMemo(
    () => makeFunctionReference<"query", {}, ConnectorRow[]>("connectors:listConnectors"),
    [],
  );
  const listGuildsRef = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        GuildRow[]
      >("discovery:listGuilds"),
    [],
  );
  const listServerConfigsByConnectorRef = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string },
        ServerConfigRow[]
      >("discordServerConfig:listServerConfigsByConnector"),
    [],
  );
  const upsertServerConfigRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        {
          tenantKey: string;
          connectorId: string;
          guildId: string;
          seatLimit: number;
          seatEnforcementEnabled: boolean;
          basicRoleId?: string;
          advancedRoleId?: string;
          proRoleId?: string;
        },
        { ok: true }
      >("discordServerConfig:upsertServerConfig"),
    [],
  );
  const removeServerConfigRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string; guildId: string },
        { ok: true; removed: boolean }
      >("discordServerConfig:removeServerConfig"),
    [],
  );
  const getServerSeatSnapshotRef = useMemo(
    () =>
      makeFunctionReference<
        "query",
        { tenantKey: string; connectorId: string; guildId: string },
        ServerSeatSnapshotRow | null
      >("discordSeatAudit:getServerSeatSnapshot"),
    [],
  );
  const requestSeatAuditRefreshRef = useMemo(
    () =>
      makeFunctionReference<
        "mutation",
        { tenantKey: string; connectorId: string; guildId: string; source?: string },
        { ok: true; deduped: boolean; jobId: string | null }
      >("discordSeatAudit:requestSeatAuditRefresh"),
    [],
  );

  const mappings = useQuery(listTierRoleMappingsRef, {});
  const runtimeStatus = useQuery(runtimeStatusRef, {});
  const connectors = useQuery(listConnectorsRef);
  const upsertTierRoleMapping = useMutation(upsertTierRoleMappingRef);
  const removeTierRoleMapping = useMutation(removeTierRoleMappingRef);
  const upsertServerConfig = useMutation(upsertServerConfigRef);
  const removeServerConfig = useMutation(removeServerConfigRef);
  const requestSeatAuditRefresh = useMutation(requestSeatAuditRefreshRef);

  const [drafts, setDrafts] = useState<Record<SubscriptionTier, DraftRow>>({
    basic: { guildId: "", roleId: "", enabled: false },
    advanced: { guildId: "", roleId: "", enabled: false },
    pro: { guildId: "", roleId: "", enabled: false },
  });
  const [savingTier, setSavingTier] = useState<SubscriptionTier | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantKey, setSelectedTenantKey] = useState("");
  const [selectedConnectorId, setSelectedConnectorId] = useState("");
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [seatLimitDraft, setSeatLimitDraft] = useState("0");
  const [seatEnforcementDraft, setSeatEnforcementDraft] = useState(true);
  const [bronzeRoleDraft, setBronzeRoleDraft] = useState("");
  const [silverRoleDraft, setSilverRoleDraft] = useState("");
  const [goldRoleDraft, setGoldRoleDraft] = useState("");
  const [serverSaving, setServerSaving] = useState(false);
  const [serverRefreshing, setServerRefreshing] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const hasConnectorSelection =
    selectedTenantKey.trim().length > 0 && selectedConnectorId.trim().length > 0;
  const connectorArgs = hasConnectorSelection
    ? { tenantKey: selectedTenantKey, connectorId: selectedConnectorId }
    : "skip";
  const guilds = useQuery(listGuildsRef, connectorArgs) ?? [];
  const serverConfigs = useQuery(listServerConfigsByConnectorRef, connectorArgs) ?? [];
  const seatSnapshot = useQuery(
    getServerSeatSnapshotRef,
    hasConnectorSelection && selectedGuildId.trim()
      ? {
          tenantKey: selectedTenantKey,
          connectorId: selectedConnectorId,
          guildId: selectedGuildId,
        }
      : "skip",
  );

  useEffect(() => {
    if (!mappings) return;
    setDrafts(toDraftState(mappings));
    console.info(`[admin/discord-bot] mappings loaded count=${mappings.length}`);
  }, [mappings]);

  useEffect(() => {
    if (!connectors || connectors.length === 0) return;
    if (selectedTenantKey && selectedConnectorId) return;
    setSelectedTenantKey(connectors[0].tenantKey);
    setSelectedConnectorId(connectors[0].connectorId);
  }, [connectors, selectedTenantKey, selectedConnectorId]);

  useEffect(() => {
    if (guilds.length === 0) {
      setSelectedGuildId("");
      return;
    }
    const exists = guilds.some((guild) => guild.guildId === selectedGuildId);
    if (!exists) {
      setSelectedGuildId(guilds[0].guildId);
    }
  }, [guilds, selectedGuildId]);

  useEffect(() => {
    if (!selectedGuildId) {
      setSeatLimitDraft("0");
      setSeatEnforcementDraft(true);
      setBronzeRoleDraft("");
      setSilverRoleDraft("");
      setGoldRoleDraft("");
      return;
    }
    const existing = serverConfigs.find((row) => row.guildId === selectedGuildId);
    setSeatLimitDraft(String(existing?.seatLimit ?? 0));
    setSeatEnforcementDraft(existing?.seatEnforcementEnabled ?? true);
    setBronzeRoleDraft(existing?.basicRoleId ?? "");
    setSilverRoleDraft(existing?.advancedRoleId ?? "");
    setGoldRoleDraft(existing?.proRoleId ?? "");
  }, [selectedGuildId, serverConfigs]);

  function formatDateTime(value: number | null | undefined) {
    if (!value) return "n/a";
    return new Date(value).toLocaleString();
  }

  function updateDraft(tier: SubscriptionTier, field: keyof DraftRow, value: string | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [field]: value,
      },
    }));
  }

  async function onSaveTier(tier: SubscriptionTier) {
    const draft = drafts[tier];
    setSavingTier(tier);
    setMessage(null);
    setError(null);
    try {
      await upsertTierRoleMapping({
        tier,
        guildId: draft.guildId,
        roleId: draft.roleId,
        enabled: draft.enabled,
      });
      setMessage(`Saved ${tier} tier mapping.`);
      console.info(`[admin/discord-bot] saved tier=${tier} enabled=${draft.enabled}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save mapping";
      setError(text);
      console.error(`[admin/discord-bot] save failed tier=${tier}: ${text}`);
    } finally {
      setSavingTier(null);
    }
  }

  async function onClearTier(tier: SubscriptionTier) {
    setSavingTier(tier);
    setMessage(null);
    setError(null);
    try {
      await removeTierRoleMapping({ tier });
      setMessage(`Cleared ${tier} tier mapping.`);
      console.info(`[admin/discord-bot] cleared tier=${tier}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to clear mapping";
      setError(text);
      console.error(`[admin/discord-bot] clear failed tier=${tier}: ${text}`);
    } finally {
      setSavingTier(null);
    }
  }

  async function onSaveServerConfig() {
    if (!hasConnectorSelection || !selectedGuildId) return;
    const parsedLimit = Number.parseInt(seatLimitDraft.trim(), 10);
    setServerSaving(true);
    setServerMessage(null);
    setServerError(null);
    try {
      await upsertServerConfig({
        tenantKey: selectedTenantKey,
        connectorId: selectedConnectorId,
        guildId: selectedGuildId,
        seatLimit: Number.isFinite(parsedLimit) ? parsedLimit : -1,
        seatEnforcementEnabled: seatEnforcementDraft,
        basicRoleId: bronzeRoleDraft,
        advancedRoleId: silverRoleDraft,
        proRoleId: goldRoleDraft,
      });
      setServerMessage("Saved server seat and tier-role config.");
      console.info(
        `[admin/discord-bot] server config saved tenant=${selectedTenantKey} connector=${selectedConnectorId} guild=${selectedGuildId} seat_limit=${parsedLimit} enforcement=${seatEnforcementDraft}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save server config";
      setServerError(text);
      console.error(
        `[admin/discord-bot] server config save failed tenant=${selectedTenantKey} connector=${selectedConnectorId} guild=${selectedGuildId}: ${text}`,
      );
    } finally {
      setServerSaving(false);
    }
  }

  async function onClearServerConfig() {
    if (!hasConnectorSelection || !selectedGuildId) return;
    setServerSaving(true);
    setServerMessage(null);
    setServerError(null);
    try {
      await removeServerConfig({
        tenantKey: selectedTenantKey,
        connectorId: selectedConnectorId,
        guildId: selectedGuildId,
      });
      setServerMessage("Cleared server config.");
      console.info(
        `[admin/discord-bot] server config cleared tenant=${selectedTenantKey} connector=${selectedConnectorId} guild=${selectedGuildId}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to clear server config";
      setServerError(text);
      console.error(
        `[admin/discord-bot] server config clear failed tenant=${selectedTenantKey} connector=${selectedConnectorId} guild=${selectedGuildId}: ${text}`,
      );
    } finally {
      setServerSaving(false);
    }
  }

  async function onRefreshSeatSnapshot() {
    if (!hasConnectorSelection || !selectedGuildId) return;
    setServerRefreshing(true);
    setServerMessage(null);
    setServerError(null);
    try {
      const result = await requestSeatAuditRefresh({
        tenantKey: selectedTenantKey,
        connectorId: selectedConnectorId,
        guildId: selectedGuildId,
        source: "admin_discord_bot_panel",
      });
      setServerMessage(
        result.deduped
          ? "Seat refresh already queued; reused pending job."
          : "Seat refresh requested.",
      );
      console.info(
        `[admin/discord-bot] seat refresh requested tenant=${selectedTenantKey} connector=${selectedConnectorId} guild=${selectedGuildId} deduped=${result.deduped}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to request seat refresh";
      setServerError(text);
      console.error(
        `[admin/discord-bot] seat refresh request failed tenant=${selectedTenantKey} connector=${selectedConnectorId} guild=${selectedGuildId}: ${text}`,
      );
    } finally {
      setServerRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Discord Bot"
        title="Tier Role Configuration"
        description="Map each subscription tier to the Discord role that should be granted."
        breadcrumbs={breadcrumbs}
      />

      <AdminSectionCard title="Runtime status">
        <div className="space-y-1 text-xs text-slate-300">
          <p>
            Role sync bot token configured:{" "}
            <strong>{runtimeStatus?.hasRoleSyncBotToken ? "yes" : "no"}</strong>
          </p>
          <p>
            Legacy env fallback configured:{" "}
            <strong>{runtimeStatus?.legacyFallbackConfigured ? "yes" : "no"}</strong>
          </p>
          {runtimeStatus?.legacyFallbackConfigured ? (
            <p>
              Legacy fallback role: {runtimeStatus.legacyGuildId} / {runtimeStatus.legacyRoleId}
            </p>
          ) : null}
        </div>
        {message ? <p className="mt-4 text-sm text-emerald-400">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
      </AdminSectionCard>

      <AdminSectionCard title="Server seat enforcement + tier roles (Bronze / Silver / Gold)">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="admin-label">
            Tenant
            <select
              value={selectedTenantKey}
              onChange={(event) => {
                const value = event.target.value;
                const connector = connectors?.find((row) => row.tenantKey === value);
                setSelectedTenantKey(value);
                setSelectedConnectorId(connector?.connectorId ?? "");
                setSelectedGuildId("");
              }}
              className="admin-input"
            >
              <option value="">Select tenant</option>
              {(connectors ?? []).map((connector) => (
                <option key={`${connector.tenantKey}:${connector.connectorId}`} value={connector.tenantKey}>
                  {connector.tenantKey}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-label">
            Connector
            <select
              value={selectedConnectorId}
              onChange={(event) => setSelectedConnectorId(event.target.value)}
              className="admin-input"
            >
              <option value="">Select connector</option>
              {(connectors ?? [])
                .filter((connector) => connector.tenantKey === selectedTenantKey)
                .map((connector) => (
                  <option key={connector._id} value={connector.connectorId}>
                    {connector.connectorId}
                  </option>
                ))}
            </select>
          </label>

          <label className="admin-label">
            Discord Guild
            <select
              value={selectedGuildId}
              onChange={(event) => setSelectedGuildId(event.target.value)}
              className="admin-input"
            >
              <option value="">Select guild</option>
              {guilds.map((guild) => (
                <option key={guild._id} value={guild.guildId}>
                  {guild.name} ({guild.guildId})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="admin-label">
            Seat limit
            <input
              type="number"
              min={0}
              value={seatLimitDraft}
              onChange={(event) => setSeatLimitDraft(event.target.value)}
              className="admin-input"
              placeholder="0"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <input
              type="checkbox"
              checked={seatEnforcementDraft}
              onChange={(event) => setSeatEnforcementDraft(event.target.checked)}
            />
            Enable seat enforcement (hard stop mirroring on over-limit)
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="admin-label">
            Bronze role ID (basic)
            <input
              value={bronzeRoleDraft}
              onChange={(event) => setBronzeRoleDraft(event.target.value)}
              className="admin-input"
              placeholder="role id"
            />
          </label>
          <label className="admin-label">
            Silver role ID (advanced)
            <input
              value={silverRoleDraft}
              onChange={(event) => setSilverRoleDraft(event.target.value)}
              className="admin-input"
              placeholder="role id"
            />
          </label>
          <label className="admin-label">
            Gold role ID (pro)
            <input
              value={goldRoleDraft}
              onChange={(event) => setGoldRoleDraft(event.target.value)}
              className="admin-input"
              placeholder="role id"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onSaveServerConfig()}
            disabled={serverSaving || !hasConnectorSelection || !selectedGuildId}
            className="admin-btn-secondary"
          >
            {serverSaving ? "Saving..." : "Save server config"}
          </button>
          <button
            type="button"
            onClick={() => void onClearServerConfig()}
            disabled={serverSaving || !hasConnectorSelection || !selectedGuildId}
            className="admin-btn-secondary"
          >
            {serverSaving ? "Clearing..." : "Clear server config"}
          </button>
          <button
            type="button"
            onClick={() => void onRefreshSeatSnapshot()}
            disabled={serverRefreshing || !hasConnectorSelection || !selectedGuildId}
            className="admin-btn-secondary"
          >
            {serverRefreshing ? "Requesting..." : "Refresh seats now"}
          </button>
        </div>

        <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
          <p>
            Snapshot status: <strong>{seatSnapshot?.status ?? "none"}</strong>
          </p>
          <p>
            Seats used / limit:{" "}
            <strong>
              {seatSnapshot ? `${seatSnapshot.seatsUsed} / ${seatSnapshot.seatLimit}` : "n/a"}
            </strong>
          </p>
          <p>
            Over limit: <strong>{seatSnapshot?.isOverLimit ? "yes" : "no"}</strong>
          </p>
          <p>
            Last checked: <strong>{formatDateTime(seatSnapshot?.checkedAt)}</strong>
          </p>
          <p>
            Next check after: <strong>{formatDateTime(seatSnapshot?.nextCheckAfter)}</strong>
          </p>
          <p>
            Last error: <strong>{seatSnapshot?.lastError ?? "none"}</strong>
          </p>
        </div>

        {serverMessage ? <p className="mt-4 text-sm text-emerald-400">{serverMessage}</p> : null}
        {serverError ? <p className="mt-4 text-sm text-rose-400">{serverError}</p> : null}
      </AdminSectionCard>

      <div className="space-y-4">
        {TIERS.map((tier) => {
          const draft = drafts[tier];
          const isSaving = savingTier === tier;
          return (
            <AdminSectionCard key={tier} title={`Legacy fallback: ${tier} tier`}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="admin-label">
                  Discord Guild ID
                  <input
                    value={draft.guildId}
                    onChange={(e) => updateDraft(tier, "guildId", e.target.value)}
                    className="admin-input"
                    placeholder="guild id"
                  />
                </label>
                <label className="admin-label">
                  Discord Role ID
                  <input
                    value={draft.roleId}
                    onChange={(e) => updateDraft(tier, "roleId", e.target.value)}
                    className="admin-input"
                    placeholder="role id"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => updateDraft(tier, "enabled", e.target.checked)}
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  onClick={() => void onSaveTier(tier)}
                  disabled={isSaving}
                  className="admin-btn-secondary"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => void onClearTier(tier)}
                  disabled={isSaving}
                  className="admin-btn-secondary"
                >
                  {isSaving ? "Clearing..." : "Clear"}
                </button>
              </div>
            </AdminSectionCard>
          );
        })}
      </div>
    </div>
  );
}
