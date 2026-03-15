"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { TagInput } from "@/components/ui/tag-input";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

// ── Types ──────────────────────────────────────────────────────────────────

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
  blockedDomains: string[];
  allowedDomains: string[];
  blockedKeywords: string[];
  allowedKeywords: string[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFilterList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

function parseFiltersDraft(raw: unknown): FilterDraft {
  const source = isRecord(raw) ? raw : {};
  return {
    blockedDomains: parseFilterList(source.blockedDomains),
    allowedDomains: parseFilterList(source.allowedDomains),
    blockedKeywords: parseFilterList(source.blockedKeywords),
    allowedKeywords: parseFilterList(source.allowedKeywords),
  };
}

function buildFiltersJson(draft: FilterDraft): Record<string, string[]> | undefined {
  const hasValues =
    draft.blockedDomains.length > 0 ||
    draft.allowedDomains.length > 0 ||
    draft.blockedKeywords.length > 0 ||
    draft.allowedKeywords.length > 0;
  if (!hasValues) return undefined;
  return {
    blockedDomains: draft.blockedDomains,
    allowedDomains: draft.allowedDomains,
    blockedKeywords: draft.blockedKeywords,
    allowedKeywords: draft.allowedKeywords,
  };
}

function connectorKey(connector: ConnectorRow): string {
  return `${connector.tenantKey}::${connector.connectorId}`;
}

// ── Module-level function references ──────────────────────────────────────

const listConnectorsRef = makeFunctionReference<"query", Record<string, never>, ConnectorRow[]>(
  "connectors:listConnectors",
);

const listMappingsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  MappingRow[]
>("connectors:listMappings");

const upsertMappingRef = makeFunctionReference<
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
>("connectors:upsertMapping");

// ── Searchable Combobox ────────────────────────────────────────────────────

type ComboboxOption = { value: string; label: string; group: string };

function ConnectorCombobox({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.group.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Group filtered options by tenant
  const grouped = useMemo(() => {
    const map = new Map<string, ComboboxOption[]>();
    for (const opt of filtered) {
      const list = map.get(opt.group) ?? [];
      list.push(opt);
      map.set(opt.group, list);
    }
    return map;
  }, [filtered]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectOption(optValue: string) {
    onChange(optValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="admin-input flex w-full items-center justify-between text-left"
      >
        <span className={selectedOption ? "text-slate-200" : "text-slate-500"}>
          {selectedOption?.label ?? "Select connector..."}
        </span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="admin-input w-full text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {grouped.size === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No results.</p>
            ) : (
              Array.from(grouped.entries()).map(([group, opts]) => (
                <div key={group}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {group}
                  </div>
                  {opts.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectOption(opt.value)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-800 ${
                        opt.value === value
                          ? "bg-indigo-500/15 text-indigo-300"
                          : "text-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rule chips (read-only display) ─────────────────────────────────────────

function RuleChips({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-block rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function FilteringPage() {
  const connectors = useQuery(listConnectorsRef, {});
  const [selectedConnectorKey, setSelectedConnectorKey] = useState("");
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [draft, setDraft] = useState<FilterDraft>({
    blockedDomains: [],
    allowedDomains: [],
    blockedKeywords: [],
    allowedKeywords: [],
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doUpsertMapping = useMutation(upsertMappingRef);

  // Default to first connector
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
  const mappings = useQuery(listMappingsRef, mappingsArgs === "skip" ? "skip" : mappingsArgs) ?? [];

  // Default to first mapping; reset when connector changes
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

  // Load draft from selected mapping
  useEffect(() => {
    const current = mappings.find((mapping) => mapping._id === selectedMappingId);
    if (!current) return;
    setDraft(parseFiltersDraft(current.filtersJson));
    setMessage(null);
    setError(null);
  }, [mappings, selectedMappingId]);

  // Connector combobox options
  const comboboxOptions: ComboboxOption[] = useMemo(
    () =>
      (connectors ?? []).map((c) => ({
        value: connectorKey(c),
        label: `${c.tenantKey} / ${c.connectorId}`,
        group: c.tenantKey,
      })),
    [connectors],
  );

  function onConnectorChange(newKey: string) {
    if (newKey === selectedConnectorKey) return;
    setSelectedConnectorKey(newKey);
    setSelectedMappingId("");
    setDraft({ blockedDomains: [], allowedDomains: [], blockedKeywords: [], allowedKeywords: [] });
    setMessage(null);
    setError(null);
  }

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
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to save filtering rules";
      setError(text);
    } finally {
      setSaving(false);
    }
  }

  const connectorRoute = selectedConnector
    ? `/mappings/${encodeURIComponent(selectedConnector.tenantKey)}/${encodeURIComponent(selectedConnector.connectorId)}`
    : "/mappings";

  // Saved rules for the selected mapping (for read-only chip display)
  const savedRules = useMemo(
    () => parseFiltersDraft(selectedMapping?.filtersJson),
    [selectedMapping],
  );
  const hasSavedRules =
    savedRules.blockedDomains.length > 0 ||
    savedRules.allowedDomains.length > 0 ||
    savedRules.blockedKeywords.length > 0 ||
    savedRules.allowedKeywords.length > 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Filtering"
        title="Message Filtering"
        description="Allow or block URL domains and keywords per source→target mapping before mirror posting."
        breadcrumbs={buildAdminBreadcrumbs("/filtering")}
        actions={
          <>
            <Link href={connectorRoute} className="admin-link">
              Open connector
            </Link>
            <Link href="/mappings" className="admin-link">
              All connectors
            </Link>
          </>
        }
      />

      <AdminSectionCard title="Select mapping">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="admin-label mb-1.5 block">Connector</label>
            <ConnectorCombobox
              options={comboboxOptions}
              value={selectedConnectorKey}
              onChange={onConnectorChange}
              disabled={!connectors || connectors.length === 0}
            />
          </div>
          <label className="admin-label">
            Route mapping
            <select
              className="admin-input"
              value={selectedMappingId}
              onChange={(e) => setSelectedMappingId(e.target.value)}
              disabled={mappings.length === 0}
            >
              {mappings.map((mapping) => (
                <option key={mapping._id} value={mapping._id}>
                  {mapping.sourceChannelId} {"→"} {mapping.targetChannelId}
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
            {/* Saved rules (read-only chips) */}
            {hasSavedRules && (
              <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-400">Currently saved rules</p>
                <div className="space-y-2">
                  <RuleChips label="Blocked domains" items={savedRules.blockedDomains} />
                  <RuleChips label="Allowed domains" items={savedRules.allowedDomains} />
                  <RuleChips label="Blocked keywords" items={savedRules.blockedKeywords} />
                  <RuleChips label="Allowed keywords" items={savedRules.allowedKeywords} />
                </div>
              </div>
            )}

            {/* Tag inputs */}
            <div className="grid gap-4 md:grid-cols-2">
              <TagInput
                label="Blocked domains"
                tags={draft.blockedDomains}
                onChange={(tags) => setDraft((d) => ({ ...d, blockedDomains: tags }))}
                placeholder="x.com, example.org"
              />
              <TagInput
                label="Allowed domains"
                tags={draft.allowedDomains}
                onChange={(tags) => setDraft((d) => ({ ...d, allowedDomains: tags }))}
                placeholder="trusted.example"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TagInput
                label="Blocked keywords"
                tags={draft.blockedKeywords}
                onChange={(tags) => setDraft((d) => ({ ...d, blockedKeywords: tags }))}
                placeholder="live, promo"
              />
              <TagInput
                label="Allowed keywords"
                tags={draft.allowedKeywords}
                onChange={(tags) => setDraft((d) => ({ ...d, allowedKeywords: tags }))}
                placeholder="liverpool, livestream"
              />
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
