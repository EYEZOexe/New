"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { CONNECTOR_SUB_NAV_TABS } from "@/lib/adminRoutes";
import { ConnectorOverviewTab } from "./connector-overview-tab";
import { ConnectorRoutesTab } from "./connector-routes-tab";
import { ConnectorJobsTab } from "./connector-jobs-tab";
import { ConnectorSettingsTab } from "./connector-settings-tab";

// ── Shared types (exported for use by tab components) ──────────────────────

export type ConnectorRow = {
  _id: string;
  tenantKey: string;
  connectorId: string;
  status: "active" | "paused";
  forwardEnabled?: boolean;
  configVersion: number;
  updatedAt: number;
  lastSeenAt: number;
};

export type SourceRow = {
  _id: string;
  guildId: string;
  channelId: string;
  isSource?: boolean;
  isTarget?: boolean;
  threadMode?: "include" | "exclude" | "only";
  isEnabled: boolean;
};

export type MappingRow = {
  _id: string;
  sourceChannelId: string;
  targetChannelId: string;
  dashboardEnabled?: boolean;
  minimumTier?: "basic" | "advanced" | "pro";
  priority?: number;
  transformJson?: unknown;
};

export type SubscriptionTier = "basic" | "advanced" | "pro";

export type SourceGuildRow = { _id: string; guildId: string; name: string };
export type SourceChannelRow = { _id: string; channelId: string; guildId: string; name: string };
export type BotGuildRow = {
  guildId: string;
  name: string;
  icon: string | null;
  active: boolean;
  lastSeenAt: number;
  updatedAt: number;
};
export type BotChannelRow = {
  guildId: string;
  channelId: string;
  name: string;
  type: number | null;
  parentId: string | null;
  position: number | null;
  active: boolean;
  lastSeenAt: number;
  updatedAt: number;
};
export type MirrorRuntimeStatusRow = {
  hasMirrorBotToken: boolean;
  usesDedicatedMirrorToken: boolean;
  sharedRoleSyncTokenFallback: boolean;
};
export type MirrorQueueStatsRow = {
  pending: number;
  pendingReady: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  updatedAt: number;
};
export type MirrorLatencySummaryRow = {
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};
export type MirrorLatencyStatsRow = {
  windowMinutes: number;
  create: MirrorLatencySummaryRow;
  update: MirrorLatencySummaryRow;
  delete: MirrorLatencySummaryRow;
};
export type MirrorJobAttachment = {
  url: string;
  name?: string;
  contentType?: string;
  hasStorageId: boolean;
  hasMirrorUrl: boolean;
  attachmentId?: string;
};
export type MirrorJobMediaRow = {
  attachmentKey: string;
  status: string;
  hasStorageId: boolean;
};
export type MirrorJobRow = {
  jobId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceGuildId: string;
  targetChannelId: string;
  eventType: "create" | "update" | "delete";
  status: "pending" | "processing" | "completed" | "failed";
  attemptCount: number;
  maxAttempts: number;
  runAfter: number;
  lastError: string | null;
  updatedAt: number;
  createdAt: number;
  content: string;
  jobAttachments: MirrorJobAttachment[];
  sourceAttachments: MirrorJobAttachment[] | null;
  mediaRows: MirrorJobMediaRow[];
  mirroredMessageId: string | null;
};
export type SeatSnapshotRow = {
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
export type ServerConfigRow = {
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

// ── Module-level Convex query references ──────────────────────────────────

const getConnectorRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  ConnectorRow | null
>("connectors:getConnector");

const listSourcesRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  SourceRow[]
>("connectors:listSources");

const listMappingsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  MappingRow[]
>("connectors:listMappings");

const listSourceGuildsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  SourceGuildRow[]
>("discovery:listGuilds");

const listSourceChannelsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string; guildId?: string },
  SourceChannelRow[]
>("discovery:listChannels");

const listBotGuildsRef = makeFunctionReference<
  "query",
  { includeInactive?: boolean },
  BotGuildRow[]
>("discordBotPresence:listBotGuilds");

const listBotGuildChannelsRef = makeFunctionReference<
  "query",
  { guildId?: string; includeInactive?: boolean },
  BotChannelRow[]
>("discordBotPresence:listBotGuildChannels");

const getMirrorRuntimeStatusRef = makeFunctionReference<
  "query",
  Record<string, never>,
  MirrorRuntimeStatusRow
>("mirror:getSignalMirrorRuntimeStatus");

const getMirrorQueueStatsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  MirrorQueueStatsRow
>("mirror:getSignalMirrorQueueStats");

const listMirrorJobsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string; limit?: number },
  MirrorJobRow[]
>("mirror:listSignalMirrorJobs");

const getMirrorLatencyStatsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string; windowMinutes?: number },
  MirrorLatencyStatsRow
>("mirror:getSignalMirrorLatencyStats");

const listSeatSnapshotsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  SeatSnapshotRow[]
>("discordSeatAudit:listSeatSnapshotsByConnector");

const listServerConfigsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  ServerConfigRow[]
>("discordServerConfig:listServerConfigsByConnector");

// ── Tab routing ────────────────────────────────────────────────────────────

const VALID_TABS = ["overview", "routes", "jobs", "settings"] as const;
type TabValue = (typeof VALID_TABS)[number];

function resolveTab(param: string | null): TabValue {
  return (VALID_TABS as readonly string[]).includes(param ?? "")
    ? (param as TabValue)
    : "overview";
}

// ── Component ──────────────────────────────────────────────────────────────

type ConnectorWorkspaceProps = {
  tenantKey: string;
  connectorId: string;
  breadcrumbs?: readonly string[];
};

function ConnectorWorkspaceInner({
  tenantKey,
  connectorId,
  breadcrumbs,
}: ConnectorWorkspaceProps) {
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));

  const hasRouteParams = tenantKey !== "" && connectorId !== "";
  const connectorArgs = hasRouteParams ? { tenantKey, connectorId } : ("skip" as const);

  const connector = useQuery(getConnectorRef, connectorArgs);
  const sources = useQuery(listSourcesRef, connectorArgs) ?? [];
  const mappings = useQuery(listMappingsRef, connectorArgs) ?? [];
  const sourceGuilds = useQuery(listSourceGuildsRef, connectorArgs) ?? [];
  const allChannels = useQuery(listSourceChannelsRef, connectorArgs) ?? [];
  const botGuilds = useQuery(listBotGuildsRef, {}) ?? [];
  const botChannels =
    useQuery(listBotGuildChannelsRef, hasRouteParams ? { includeInactive: false } : "skip") ?? [];
  const mirrorRuntime = useQuery(getMirrorRuntimeStatusRef, {});
  const mirrorQueueStats = useQuery(getMirrorQueueStatsRef, connectorArgs);
  const mirrorLatencyStats = useQuery(
    getMirrorLatencyStatsRef,
    hasRouteParams ? { tenantKey, connectorId, windowMinutes: 60 } : "skip",
  );
  const mirrorJobs =
    useQuery(listMirrorJobsRef, hasRouteParams ? { tenantKey, connectorId, limit: 50 } : "skip") ??
    [];
  const seatSnapshots = useQuery(listSeatSnapshotsRef, connectorArgs) ?? [];
  const serverConfigs = useQuery(listServerConfigsRef, connectorArgs) ?? [];

  const connectorDetailPath = `/mappings/${encodeURIComponent(tenantKey)}/${encodeURIComponent(connectorId)}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Mappings"
        title={`${tenantKey || "unknown"} / ${connectorId || "unknown"}`}
        description="Configure connector routing, jobs, and settings."
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
        <>
          {/* Tab navigation */}
          <div className="flex border-b border-slate-800">
            {CONNECTOR_SUB_NAV_TABS.map((tab) => (
              <Link
                key={tab.tabValue}
                href={`${connectorDetailPath}?tab=${tab.tabValue}`}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.tabValue
                    ? "border-b-2 border-indigo-400 text-indigo-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {activeTab === "overview" && (
            <ConnectorOverviewTab
              tenantKey={tenantKey}
              connectorId={connectorId}
              connector={connector}
              mirrorRuntime={mirrorRuntime}
              mirrorQueueStats={mirrorQueueStats}
              mirrorLatencyStats={mirrorLatencyStats}
              seatSnapshots={seatSnapshots}
              serverConfigs={serverConfigs}
              sourceGuilds={sourceGuilds}
              botGuilds={botGuilds}
              sources={sources}
              allChannels={allChannels}
              botChannels={botChannels}
            />
          )}

          {activeTab === "routes" && (
            <ConnectorRoutesTab
              tenantKey={tenantKey}
              connectorId={connectorId}
              sources={sources}
              mappings={mappings}
              sourceGuilds={sourceGuilds}
              allChannels={allChannels}
              botGuilds={botGuilds}
              botChannels={botChannels}
              seatSnapshots={seatSnapshots}
              serverConfigs={serverConfigs}
            />
          )}

          {activeTab === "jobs" && (
            <ConnectorJobsTab
              tenantKey={tenantKey}
              connectorId={connectorId}
              mirrorJobs={mirrorJobs}
              allChannels={allChannels}
              botChannels={botChannels}
              sources={sources}
            />
          )}

          {activeTab === "settings" && (
            <ConnectorSettingsTab
              tenantKey={tenantKey}
              connectorId={connectorId}
              connector={connector}
            />
          )}
        </>
      )}
    </div>
  );
}

export function ConnectorWorkspace(props: ConnectorWorkspaceProps) {
  return (
    <Suspense fallback={null}>
      <ConnectorWorkspaceInner {...props} />
    </Suspense>
  );
}
