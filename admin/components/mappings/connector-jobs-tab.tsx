"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AdminTableShell } from "@/components/admin/admin-table-shell";
import type {
  MirrorJobRow,
  SourceRow,
  SourceChannelRow,
  BotChannelRow,
} from "./connector-workspace";

// ── Module-level mutation reference ───────────────────────────────────────

const requeueMirrorJobRef = makeFunctionReference<
  "mutation",
  {
    tenantKey: string;
    connectorId: string;
    sourceMessageId: string;
    targetChannelId: string;
  },
  { ok: boolean; reason?: string; enqueued?: number; deduped?: number }
>("mirror:requeueMirrorJobForTarget");

// ── Types ──────────────────────────────────────────────────────────────────

type EventTypeFilter = "all" | "create" | "update" | "delete";
type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";

// ── Props ──────────────────────────────────────────────────────────────────

type ConnectorJobsTabProps = {
  tenantKey: string;
  connectorId: string;
  mirrorJobs: MirrorJobRow[];
  allChannels: SourceChannelRow[];
  botChannels: BotChannelRow[];
  sources: SourceRow[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(value: number | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
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

// ── Component ──────────────────────────────────────────────────────────────

export function ConnectorJobsTab({
  tenantKey,
  connectorId,
  mirrorJobs,
  allChannels,
  botChannels,
}: ConnectorJobsTabProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [requeueingJobId, setRequeuingJobId] = useState<string | null>(null);
  const [requeueResult, setRequeueResult] = useState<{
    jobId: string;
    message: string;
    ok: boolean;
  } | null>(null);

  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const doRequeue = useMutation(requeueMirrorJobRef);

  const channelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const channel of allChannels) map.set(channel.channelId, channel.name);
    for (const channel of botChannels) {
      if (!map.has(channel.channelId)) map.set(channel.channelId, channel.name);
    }
    return map;
  }, [allChannels, botChannels]);

  function renderChannelLabel(channelId: string) {
    return `${channelNameById.get(channelId) ?? "Unknown channel"} (${channelId})`;
  }

  // Separate failed jobs (pinned top when filter is ALL)
  const failedJobs = useMemo(
    () => mirrorJobs.filter((job) => job.status === "failed"),
    [mirrorJobs],
  );

  const filteredJobs = useMemo(() => {
    const isAllFilters = eventTypeFilter === "all" && statusFilter === "all";

    // When all filters are default, show non-failed jobs below (failed are pinned above)
    const jobs = isAllFilters
      ? mirrorJobs.filter((job) => job.status !== "failed")
      : mirrorJobs.filter((job) => {
          if (eventTypeFilter !== "all" && job.eventType !== eventTypeFilter) return false;
          if (statusFilter !== "all" && job.status !== statusFilter) return false;
          return true;
        });

    return jobs;
  }, [mirrorJobs, eventTypeFilter, statusFilter]);

  const isAllFilters = eventTypeFilter === "all" && statusFilter === "all";
  const showPinnedFailed = isAllFilters && failedJobs.length > 0;

  function clearFilters() {
    setEventTypeFilter("all");
    setStatusFilter("all");
  }

  async function onRetry(job: MirrorJobRow) {
    setRequeuingJobId(job.jobId);
    setRequeueResult(null);
    try {
      const res = await doRequeue({
        tenantKey,
        connectorId,
        sourceMessageId: job.sourceMessageId,
        targetChannelId: job.targetChannelId,
      });
      setRequeueResult({
        jobId: job.jobId,
        ok: res.ok,
        message: res.ok
          ? res.enqueued
            ? `Enqueued ${res.enqueued} job(s)`
            : "Already queued (deduped)"
          : (res.reason ?? "failed"),
      });
    } catch (err) {
      setRequeueResult({ jobId: job.jobId, ok: false, message: String(err) });
    } finally {
      setRequeuingJobId(null);
    }
  }

  function renderJobRow(job: MirrorJobRow, pinned = false) {
    const isExpanded = expandedJobId === job.jobId;
    const isRequeuing = requeueingJobId === job.jobId;
    const thisRequeueResult = requeueResult?.jobId === job.jobId ? requeueResult : null;
    const sourceImgCount = (job.sourceAttachments ?? job.jobAttachments).filter(
      (a) =>
        a.contentType?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name ?? a.url),
    ).length;
    const dbFailedCount = job.mediaRows.filter((r) => r.status === "failed").length;
    const signalReadyCount = (job.sourceAttachments ?? job.jobAttachments).filter(
      (a) => a.hasMirrorUrl,
    ).length;

    return (
      <>
        <tr
          key={job.jobId}
          className={`cursor-pointer hover:bg-slate-800/40 ${pinned ? "border-l-2 border-red-500" : ""}`}
          onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
        >
          <td className="px-2 py-2 text-slate-400">
            <span className="text-xs">{isExpanded ? "▾" : "▸"}</span>
          </td>
          <td className="px-3 py-2 text-xs text-slate-300">{formatDateTime(job.updatedAt)}</td>
          <td className="px-3 py-2">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                job.eventType === "create"
                  ? "bg-emerald-900/50 text-emerald-300"
                  : job.eventType === "update"
                    ? "bg-sky-900/50 text-sky-300"
                    : "bg-rose-900/50 text-rose-300"
              }`}
            >
              {job.eventType}
            </span>
          </td>
          <td className="px-3 py-2">
            <p className="text-xs text-slate-100">{renderChannelLabel(job.sourceChannelId)}</p>
            <p className="text-xs text-slate-400">→ {renderChannelLabel(job.targetChannelId)}</p>
          </td>
          <td className="px-3 py-2">{renderJobStatusBadge(job.status)}</td>
          <td className="px-3 py-2 text-xs text-slate-300">
            {job.attemptCount}/{job.maxAttempts}
          </td>
          <td className="px-3 py-2 text-xs">
            {sourceImgCount === 0 ? (
              <span className="text-slate-500">none</span>
            ) : (
              <span
                className={`font-mono ${
                  signalReadyCount === sourceImgCount
                    ? "text-emerald-400"
                    : dbFailedCount > 0
                      ? "text-rose-400"
                      : "text-amber-400"
                }`}
              >
                {signalReadyCount}/{sourceImgCount} ready
                {dbFailedCount > 0 && (
                  <span className="ml-1 text-rose-400">({dbFailedCount} failed)</span>
                )}
              </span>
            )}
          </td>
          <td className="px-3 py-2 text-xs">
            {job.lastError ? (
              <span className="text-rose-300">{job.lastError}</span>
            ) : (
              <span className="text-slate-500">none</span>
            )}
          </td>
          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={isRequeuing}
              className="rounded bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              onClick={() => void onRetry(job)}
            >
              {isRequeuing ? "…" : "Retry"}
            </button>
            {thisRequeueResult && (
              <p
                className={`mt-1 text-xs ${thisRequeueResult.ok ? "text-emerald-400" : "text-rose-400"}`}
              >
                {thisRequeueResult.message}
              </p>
            )}
          </td>
        </tr>
        {isExpanded && (
          <tr key={`${job.jobId}-expanded`} className="bg-slate-900/60">
            <td colSpan={9} className="px-4 py-3">
              <div className="space-y-3 text-xs">
                <div>
                  <p className="mb-1 font-semibold text-slate-300">Message content</p>
                  <p className="rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-200 whitespace-pre-wrap break-all">
                    {job.content?.trim() || (
                      <span className="italic text-slate-500">(empty — image-only message)</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-slate-400">
                  <span>
                    Source msg:{" "}
                    <span className="font-mono text-slate-200">{job.sourceMessageId}</span>
                  </span>
                  {job.mirroredMessageId && (
                    <span>
                      Mirrored msg:{" "}
                      <span className="font-mono text-slate-200">{job.mirroredMessageId}</span>
                    </span>
                  )}
                  <span>
                    Run after:{" "}
                    <span className="text-slate-200">{formatDateTime(job.runAfter)}</span>
                  </span>
                </div>
                {sourceImgCount > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-300">Attachment pipeline</p>
                    <div className="overflow-x-auto rounded border border-slate-700">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-800 text-slate-400">
                          <tr>
                            <th className="px-2 py-1 text-left">File</th>
                            <th className="px-2 py-1 text-left">Seen from source</th>
                            <th className="px-2 py-1 text-left">DB (Convex storage)</th>
                            <th className="px-2 py-1 text-left">On signal (mirrorUrl)</th>
                            <th className="px-2 py-1 text-left">On job (queued)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {(job.sourceAttachments ?? job.jobAttachments).map((att, i) => {
                            const isImg =
                              att.contentType?.startsWith("image/") ||
                              /\.(png|jpg|jpeg|gif|webp)$/i.test(att.name ?? att.url);
                            const mediaRow = job.mediaRows.find((r) => {
                              if (att.attachmentId && r.attachmentKey === `id:${att.attachmentId}`)
                                return true;
                              if (r.attachmentKey === `url:${att.url}`) return true;
                              return false;
                            });
                            const jobAtt = job.jobAttachments[i];
                            return (
                              <tr key={i} className="text-slate-300">
                                <td className="px-2 py-1 font-mono">
                                  <span className="text-slate-400">
                                    {att.name ?? `attachment-${i + 1}`}
                                  </span>
                                  {!isImg && (
                                    <span className="ml-1 italic text-slate-500">(non-image)</span>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  <span className="text-emerald-400">✓ seen</span>
                                </td>
                                <td className="px-2 py-1">
                                  {!mediaRow ? (
                                    <span className="text-slate-500">no row</span>
                                  ) : mediaRow.status === "ready" ? (
                                    <span className="text-emerald-400">✓ ready</span>
                                  ) : mediaRow.status === "failed" ? (
                                    <span className="text-rose-400">✗ failed</span>
                                  ) : (
                                    <span className="text-amber-400">⏳ {mediaRow.status}</span>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  {att.hasMirrorUrl ? (
                                    <span className="text-emerald-400">✓ set</span>
                                  ) : att.hasStorageId ? (
                                    <span className="text-amber-400">stored, no url</span>
                                  ) : (
                                    <span className="text-rose-400">✗ missing</span>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  {!jobAtt ? (
                                    <span className="text-slate-500">—</span>
                                  ) : jobAtt.hasMirrorUrl ? (
                                    <span className="text-emerald-400">✓ set</span>
                                  ) : (
                                    <span className="text-rose-400">✗ missing</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
          Event type
          <select
            className="admin-input w-32"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value as EventTypeFilter)}
          >
            <option value="all">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
          Status
          <select
            className="admin-input w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        {!isAllFilters && (
          <button type="button" onClick={clearFilters} className="admin-btn-secondary text-xs">
            Clear filters
          </button>
        )}
      </div>

      {/* Jobs table */}
      <AdminTableShell
        title="Mirror Jobs"
        isEmpty={mirrorJobs.length === 0}
        emptyMessage="No mirror jobs yet."
        tableClassName="overflow-x-auto"
      >
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-xs font-semibold text-slate-300">
            <tr>
              <th className="w-4 px-2 py-2" />
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Images</th>
              <th className="px-3 py-2">Last error</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-200">
            {showPinnedFailed && (
              <>
                {failedJobs.map((job) => renderJobRow(job, true))}
                {filteredJobs.length > 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="border-t border-slate-700 px-3 py-1 text-[11px] text-slate-500"
                    >
                      — other jobs —
                    </td>
                  </tr>
                )}
              </>
            )}
            {filteredJobs.map((job) => renderJobRow(job, false))}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
