"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SubscriptionTier = "basic" | "advanced" | "pro";
const TIERS: SubscriptionTier[] = ["basic", "advanced", "pro"];

type TierRoleMappingRow = {
  tier: SubscriptionTier;
  productId: string;
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
  productId: string;
  guildId: string;
  roleId: string;
  enabled: boolean;
};

function toDraftState(rows: TierRoleMappingRow[]): Record<SubscriptionTier, DraftRow> {
  const map = new Map(rows.map((row) => [row.tier, row]));
  return {
    basic: {
      productId: map.get("basic")?.productId ?? "",
      guildId: map.get("basic")?.guildId ?? "",
      roleId: map.get("basic")?.roleId ?? "",
      enabled: map.get("basic")?.enabled ?? false,
    },
    advanced: {
      productId: map.get("advanced")?.productId ?? "",
      guildId: map.get("advanced")?.guildId ?? "",
      roleId: map.get("advanced")?.roleId ?? "",
      enabled: map.get("advanced")?.enabled ?? false,
    },
    pro: {
      productId: map.get("pro")?.productId ?? "",
      guildId: map.get("pro")?.guildId ?? "",
      roleId: map.get("pro")?.roleId ?? "",
      enabled: map.get("pro")?.enabled ?? false,
    },
  };
}

export default function DiscordRoleConfigPage() {
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
          productId: string;
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
    basic: { productId: "", guildId: "", roleId: "", enabled: false },
    advanced: { productId: "", guildId: "", roleId: "", enabled: false },
    pro: { productId: "", guildId: "", roleId: "", enabled: false },
  });
  const [savingTier, setSavingTier] = useState<SubscriptionTier | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mappings) return;
    setDrafts(toDraftState(mappings));
    console.info(
      `[admin/discord-config] mappings loaded count=${mappings.length}`,
    );
  }, [mappings]);

  function updateDraft(
    tier: SubscriptionTier,
    field: keyof DraftRow,
    value: string | boolean,
  ) {
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
        productId: draft.productId,
        guildId: draft.guildId,
        roleId: draft.roleId,
        enabled: draft.enabled,
      });
      setMessage(`Saved ${tier} tier mapping.`);
      console.info(
        `[admin/discord-config] saved tier=${tier} enabled=${draft.enabled}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save mapping";
      setError(text);
      console.error(`[admin/discord-config] save failed tier=${tier}: ${text}`);
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
      console.info(`[admin/discord-config] cleared tier=${tier}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to clear mapping";
      setError(text);
      console.error(`[admin/discord-config] clear failed tier=${tier}: ${text}`);
    } finally {
      setSavingTier(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <section className="mx-auto w-full max-w-6xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Discord Tier Role Config
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Map Sell product IDs to Discord roles for Basic, Advanced, and Pro.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium underline">
              Home
            </Link>
            <Link href="/connectors" className="text-sm font-medium underline">
              Connectors
            </Link>
            <Link href="/payments/customers" className="text-sm font-medium underline">
              Payment customers
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
          <p>
            Role sync bot token configured:{" "}
            <strong>{runtimeStatus?.hasRoleSyncBotToken ? "yes" : "no"}</strong>
          </p>
          <p className="mt-1">
            Legacy env fallback configured:{" "}
            <strong>{runtimeStatus?.legacyFallbackConfigured ? "yes" : "no"}</strong>
          </p>
          {runtimeStatus?.legacyFallbackConfigured ? (
            <p className="mt-1">
              Legacy fallback role: {runtimeStatus.legacyGuildId} /{" "}
              {runtimeStatus.legacyRoleId}
            </p>
          ) : null}
        </div>

        {message ? (
          <p className="mt-4 text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 space-y-4">
          {TIERS.map((tier) => {
            const draft = drafts[tier];
            const isSaving = savingTier === tier;
            return (
              <article
                key={tier}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900">
                  {tier}
                </h2>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Sell Product ID
                    <input
                      value={draft.productId}
                      onChange={(e) => updateDraft(tier, "productId", e.target.value)}
                      className="h-9 rounded-md border border-zinc-300 px-3 text-sm"
                      placeholder="sell product id"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Discord Guild ID
                    <input
                      value={draft.guildId}
                      onChange={(e) => updateDraft(tier, "guildId", e.target.value)}
                      className="h-9 rounded-md border border-zinc-300 px-3 text-sm"
                      placeholder="guild id"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Discord Role ID
                    <input
                      value={draft.roleId}
                      onChange={(e) => updateDraft(tier, "roleId", e.target.value)}
                      className="h-9 rounded-md border border-zinc-300 px-3 text-sm"
                      placeholder="role id"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
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
                    className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onClearTier(tier)}
                    disabled={isSaving}
                    className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
                  >
                    {isSaving ? "Clearing..." : "Clear"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
