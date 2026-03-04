"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

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

type MappingRow = {
  _id: string;
  sourceChannelId: string;
  targetChannelId: string;
  dashboardEnabled?: boolean;
  minimumTier?: "basic" | "advanced" | "pro";
  priority?: number;
  filtersJson?: unknown;
  transformJson?: unknown;
};

type FilterDraft = {
  blockedDomains: string;
  allowedDomains: string;
  blockedKeywords: string;
  allowedKeywords: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFilterList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim();
    if (!normalized) continue;
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push(normalized);
  }
  return items;
}

function parseFiltersDraft(raw: unknown): FilterDraft {
  const source = isRecord(raw) ? raw : {};
  return {
    blockedDomains: parseFilterList(source.blockedDomains).join("\n"),
    allowedDomains: parseFilterList(source.allowedDomains).join("\n"),
    blockedKeywords: parseFilterList(source.blockedKeywords).join("\n"),
    allowedKeywords: parseFilterList(source.allowedKeywords).join("\n"),
  };
}

function parseEditorList(value: string, mode: "domain" | "keyword"): string[] {
  const seen = new Set<string>();
  const rows = value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const normalized: string[] = [];

  for (const row of rows) {
    const token =
      mode === "domain"
        ? row.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/", 1)[0] ?? ""
        : row.toLowerCase();
    if (!token) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    normalized.push(token);
  }
  return normalized;
}

function buildFiltersJson(draft: FilterDraft): Record<string, string[]> | undefined {
  const blockedDomains = parseEditorList(draft.blockedDomains, "domain");
  const allowedDomains = parseEditorList(draft.allowedDomains, "domain");
  const blockedKeywords = parseEditorList(draft.blockedKeywords, "keyword");
  const allowedKeywords = parseEditorList(draft.allowedKeywords, "keyword");

  const hasValues =
    blockedDomains.length > 0 ||
    allowedDomains.length > 0 ||
    blockedKeywords.length > 0 ||
    allowedKeywords.length > 0;
  if (!hasValues) return undefined;

  return {
    blockedDomains,
    allowedDomains,
    blockedKeywords,
    allowedKeywords,
  };
}

function connectorKey(connector: ConnectorRow): string {
  return `${connector.tenantKey}::${connector.connectorId}`;
}

export default function FilteringPage() {
  const listConnectors = useMemo(
    () => makeFunctionReference<"query", {}, ConnectorRow[]>("connectors:listConnectors"),
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
          minimumTier?: "basic" | "advanced" | "pro";
          filtersJson?: unknown;
          transformJson?: unknown;
          priority?: number;
        },
        { ok: true }
      >("connectors:upsertMapping"),
    [],
  );

  const connectors = useQuery(listConnectors);
  const [selectedConnectorKey, setSelectedConnectorKey] = useState("");
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [draft, setDraft] = useState<FilterDraft>({
    blockedDomains: "",
    allowedDomains: "",
    blockedKeywords: "",
    allowedKeywords: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doUpsertMapping = useMutation(upsertMapping);

  useEffect(() => {
    if (!connectors || connectors.length === 0) return;
    if (selectedConnectorKey) return;
    setSelectedConnectorKey(connectorKey(connectors[0]));
  }, [connectors, selectedConnectorKey]);

  const selectedConnector = useMemo(
    () => connectors?.find((row) => connectorKey(row) === selectedConnectorKey) ?? null,
    [connectors, selectedConnectorKey],
  );

  const mappingsArgs = selectedConnector
    ? { tenantKey: selectedConnector.tenantKey, connectorId: selectedConnector.connectorId }
    : "skip";
  const mappings = useQuery(listMappings, mappingsArgs === "skip" ? "skip" : mappingsArgs) ?? [];

  useEffect(() => {
    if (mappings.length === 0) {
      setSelectedMappingId("");
      return;
    }
    if (!selectedMappingId || !mappings.some((mapping) => mapping._id === selectedMappingId)) {
      setSelectedMappingId(mappings[0]._id);
    }
  }, [mappings, selectedMappingId]);

  const selectedMapping =
    mappings.find((mapping) => mapping._id === selectedMappingId) ?? null;

  useEffect(() => {
    const current = mappings.find((mapping) => mapping._id === selectedMappingId);
    if (!current) return;
    setDraft(parseFiltersDraft(current.filtersJson));
    setMessage(null);
    setError(null);
    console.info(
      `[admin/filtering] loaded mapping filters source=${current.sourceChannelId} target=${current.targetChannelId}`,
    );
  }, [mappings, selectedMappingId]);

  async function onSaveFilters() {
    if (!selectedConnector || !selectedMapping) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const filtersJson = buildFiltersJson(draft);
      await doUpsertMapping({
        tenantKey: selectedConnector.tenantKey,
        connectorId: selectedConnector.connectorId,
        sourceChannelId: selectedMapping.sourceChannelId,
        targetChannelId: selectedMapping.targetChannelId,
        dashboardEnabled: selectedMapping.dashboardEnabled,
        minimumTier: selectedMapping.minimumTier,
        priority: selectedMapping.priority,
        transformJson: selectedMapping.transformJson,
        filtersJson,
      });
      setMessage("Filtering rules saved.");
      console.info(
        `[admin/filtering] saved rules tenant=${selectedConnector.tenantKey} connector=${selectedConnector.connectorId} source=${selectedMapping.sourceChannelId} target=${selectedMapping.targetChannelId} blocked_domains=${filtersJson?.blockedDomains.length ?? 0} allowed_domains=${filtersJson?.allowedDomains.length ?? 0} blocked_keywords=${filtersJson?.blockedKeywords.length ?? 0} allowed_keywords=${filtersJson?.allowedKeywords.length ?? 0}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save filtering rules";
      setError(text);
      console.error(
        `[admin/filtering] save failed source=${selectedMapping.sourceChannelId} target=${selectedMapping.targetChannelId} error=${text}`,
      );
    } finally {
      setSaving(false);
    }
  }

  const connectorRoute = selectedConnector
    ? `/mappings/${encodeURIComponent(selectedConnector.tenantKey)}/${encodeURIComponent(
        selectedConnector.connectorId,
      )}`
    : "/mappings";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Filtering"
        title="Message Filtering"
        description="Allow or block URL domains and keywords per source->target mapping before mirror posting."
        breadcrumbs={buildAdminBreadcrumbs("/filtering")}
        actions={
          <>
            <Link href={connectorRoute} className="admin-link">
              Open connector mapping
            </Link>
            <Link href="/mappings" className="admin-link">
              All connectors
            </Link>
          </>
        }
      />

      <AdminSectionCard title="Select mapping">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="admin-label">
            Connector
            <select
              className="admin-input"
              value={selectedConnectorKey}
              onChange={(event) => setSelectedConnectorKey(event.target.value)}
              disabled={!connectors || connectors.length === 0}
            >
              {connectors?.map((connector) => (
                <option key={connector._id} value={connectorKey(connector)}>
                  {connector.tenantKey} / {connector.connectorId}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-label">
            Route mapping
            <select
              className="admin-input"
              value={selectedMappingId}
              onChange={(event) => setSelectedMappingId(event.target.value)}
              disabled={mappings.length === 0}
            >
              {mappings.map((mapping) => (
                <option key={mapping._id} value={mapping._id}>
                  {mapping.sourceChannelId} {"->"} {mapping.targetChannelId}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Rules are applied before the mirror bot posts. Allow-list entries override matching
          block-list entries.
        </p>
      </AdminSectionCard>

      <AdminSectionCard title="Filtering rules">
        {!selectedMapping ? (
          <p className="text-sm text-slate-300">
            No mapping available for this connector yet. Create one in Mappings first.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="admin-label">
                Blocked domains
                <textarea
                  className="admin-input min-h-28"
                  value={draft.blockedDomains}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, blockedDomains: event.target.value }))
                  }
                  placeholder={"x.com\nexample.org"}
                />
              </label>
              <label className="admin-label">
                Allowed domains
                <textarea
                  className="admin-input min-h-28"
                  value={draft.allowedDomains}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, allowedDomains: event.target.value }))
                  }
                  placeholder={"trusted.example\nalerts.site"}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="admin-label">
                Blocked keywords
                <textarea
                  className="admin-input min-h-28"
                  value={draft.blockedKeywords}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, blockedKeywords: event.target.value }))
                  }
                  placeholder={"live\npromo"}
                />
              </label>
              <label className="admin-label">
                Allowed keywords
                <textarea
                  className="admin-input min-h-28"
                  value={draft.allowedKeywords}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, allowedKeywords: event.target.value }))
                  }
                  placeholder={"liverpool\nlivestream"}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="admin-btn-primary"
                onClick={() => void onSaveFilters()}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save filters"}
              </button>
              {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
              {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            </div>
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
