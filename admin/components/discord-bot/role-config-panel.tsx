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

  const mappings = useQuery(listTierRoleMappingsRef, {});
  const runtimeStatus = useQuery(runtimeStatusRef, {});
  const upsertTierRoleMapping = useMutation(upsertTierRoleMappingRef);
  const removeTierRoleMapping = useMutation(removeTierRoleMappingRef);

  const [drafts, setDrafts] = useState<Record<SubscriptionTier, DraftRow>>({
    basic: { guildId: "", roleId: "", enabled: false },
    advanced: { guildId: "", roleId: "", enabled: false },
    pro: { guildId: "", roleId: "", enabled: false },
  });
  const [savingTier, setSavingTier] = useState<SubscriptionTier | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mappings) return;
    setDrafts(toDraftState(mappings));
    console.info(`[admin/discord-bot] mappings loaded count=${mappings.length}`);
  }, [mappings]);

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

      <div className="space-y-4">
        {TIERS.map((tier) => {
          const draft = drafts[tier];
          const isSaving = savingTier === tier;
          return (
            <AdminSectionCard key={tier} title={`${tier} tier`}>
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
