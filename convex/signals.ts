import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { query } from "./_generated/server";
import { hasActiveSubscriptionAccess } from "./subscriptionAccess";
import {
  filterVisibleChannelIdsForTier,
  type SubscriptionTier,
} from "./tierVisibility";

const MAX_ATTACHMENT_NAME_LENGTH = 180;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function sanitizeAttachment(attachment: {
  attachmentId?: string;
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
}): {
  attachmentId?: string;
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
} | null {
  const url = typeof attachment.url === "string" ? attachment.url.trim() : "";
  if (!isHttpUrl(url)) return null;

  const attachmentId =
    typeof attachment.attachmentId === "string"
      ? attachment.attachmentId.trim()
      : "";
  const name = typeof attachment.name === "string" ? attachment.name.trim() : "";
  const contentType =
    typeof attachment.contentType === "string"
      ? attachment.contentType.trim().toLowerCase()
      : "";
  const size =
    typeof attachment.size === "number" &&
    Number.isFinite(attachment.size) &&
    attachment.size >= 0
      ? Math.floor(attachment.size)
      : undefined;

  return {
    ...(attachmentId ? { attachmentId } : {}),
    url,
    ...(name
      ? { name: name.slice(0, MAX_ATTACHMENT_NAME_LENGTH) }
      : {}),
    ...(contentType ? { contentType } : {}),
    ...(typeof size === "number" ? { size } : {}),
  };
}

export const listRecent = query({
  args: {
    tenantKey: v.string(),
    connectorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      console.info("[signals] blocked unauthenticated listRecent request");
      return [];
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!hasActiveSubscriptionAccess(subscription, Date.now())) {
      console.info(
        `[signals] blocked user=${String(userId)} status=${subscription?.status ?? "none"} tenant=${args.tenantKey} connector=${args.connectorId}`,
      );
      return [];
    }

    const tenantKey = args.tenantKey.trim();
    const connectorId = args.connectorId.trim();
    if (!tenantKey || !connectorId) {
      console.info("[signals] listRecent skipped missing tenant/connector");
      return [];
    }

    const limit = Math.max(1, Math.min(200, args.limit ?? 50));

    const mappingRules = await ctx.db
      .query("connectorMappings")
      .withIndex("by_tenant_connectorId", (q) =>
        q.eq("tenantKey", tenantKey).eq("connectorId", connectorId),
      )
      .collect();
    const viewerTier = (subscription?.tier ?? null) as SubscriptionTier | null;
    const visibleChannelIds = filterVisibleChannelIdsForTier(
      viewerTier,
      mappingRules.map((mapping) => ({
        channelId: mapping.sourceChannelId,
        dashboardEnabled: mapping.dashboardEnabled,
        minimumTier: mapping.minimumTier,
      })),
    );
    const visibleChannelSet = new Set(visibleChannelIds);
    if (visibleChannelSet.size === 0) {
      console.info(
        `[signals] listRecent gated_no_visible_channels tenant=${tenantKey} connector=${connectorId} tier=${viewerTier ?? "none"} mappings=${mappingRules.length}`,
      );
      return [];
    }

    const candidateRows = await ctx.db
      .query("signals")
      .withIndex("by_createdAt", (q) =>
        q.eq("tenantKey", tenantKey).eq("connectorId", connectorId),
      )
      .order("desc")
      .take(Math.min(2000, limit * 10));
    const rows = candidateRows
      .filter((row) => visibleChannelSet.has(row.sourceChannelId))
      .slice(0, limit);

    const sanitized = rows.map((row) => {
      const rawAttachments = Array.isArray(row.attachments) ? row.attachments : [];
      const attachments = rawAttachments
        .map((attachment) =>
          sanitizeAttachment({
            attachmentId:
              typeof (attachment as { attachmentId?: unknown }).attachmentId === "string"
                ? ((attachment as { attachmentId?: string }).attachmentId ?? undefined)
                : undefined,
            url: String((attachment as { url?: unknown }).url ?? ""),
            name:
              typeof (attachment as { name?: unknown }).name === "string"
                ? ((attachment as { name?: string }).name ?? undefined)
                : undefined,
            contentType:
              typeof (attachment as { contentType?: unknown }).contentType === "string"
                ? ((attachment as { contentType?: string }).contentType ?? undefined)
                : undefined,
            size:
              typeof (attachment as { size?: unknown }).size === "number"
                ? ((attachment as { size?: number }).size ?? undefined)
                : undefined,
          }),
        )
        .filter((value): value is NonNullable<typeof value> => value !== null);

      return {
        ...row,
        attachments,
      };
    });

    const attachmentCount = sanitized.reduce(
      (total, row) => total + (row.attachments?.length ?? 0),
      0,
    );
    console.info(
      `[signals] listRecent tenant=${tenantKey} connector=${connectorId} tier=${viewerTier ?? "none"} visible_channels=${visibleChannelSet.size} scanned=${candidateRows.length} returned=${sanitized.length} attachment_refs=${attachmentCount}`,
    );

    return sanitized;
  },
});

export const listViewerConnectorOptions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      console.info("[signals] blocked unauthenticated listViewerConnectorOptions request");
      return [];
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!hasActiveSubscriptionAccess(subscription, Date.now())) {
      console.info(
        `[signals] listViewerConnectorOptions blocked user=${String(userId)} status=${subscription?.status ?? "none"}`,
      );
      return [];
    }

    const viewerTier = (subscription?.tier ?? null) as SubscriptionTier | null;
    const mappingRows = await ctx.db.query("connectorMappings").collect();
    const grouped = new Map<
      string,
      {
        tenantKey: string;
        connectorId: string;
        configuredChannelCount: number;
        rules: Array<{
          channelId: string;
          dashboardEnabled?: boolean;
          minimumTier?: SubscriptionTier | null;
        }>;
      }
    >();

    for (const row of mappingRows) {
      const tenantKey = row.tenantKey.trim();
      const connectorId = row.connectorId.trim();
      if (!tenantKey || !connectorId) continue;

      const key = `${tenantKey}::${connectorId}`;
      const current = grouped.get(key) ?? {
        tenantKey,
        connectorId,
        configuredChannelCount: 0,
        rules: [],
      };
      current.rules.push({
        channelId: row.sourceChannelId,
        dashboardEnabled: row.dashboardEnabled,
        minimumTier: row.minimumTier ?? null,
      });
      if (row.dashboardEnabled === true && row.minimumTier) {
        current.configuredChannelCount += 1;
      }
      grouped.set(key, current);
    }

    const options = Array.from(grouped.values())
      .map((group) => {
        const visibleChannelCount = filterVisibleChannelIdsForTier(viewerTier, group.rules).length;
        return {
          tenantKey: group.tenantKey,
          connectorId: group.connectorId,
          configuredChannelCount: group.configuredChannelCount,
          visibleChannelCount,
        };
      })
      .filter((row) => row.visibleChannelCount > 0)
      .sort((left, right) => {
        if (left.visibleChannelCount !== right.visibleChannelCount) {
          return right.visibleChannelCount - left.visibleChannelCount;
        }
        if (left.configuredChannelCount !== right.configuredChannelCount) {
          return right.configuredChannelCount - left.configuredChannelCount;
        }
        const tenantDiff = left.tenantKey.localeCompare(right.tenantKey);
        if (tenantDiff !== 0) return tenantDiff;
        return left.connectorId.localeCompare(right.connectorId);
      })
      .slice(0, 100);

    console.info(
      `[signals] listViewerConnectorOptions user=${String(userId)} tier=${viewerTier ?? "none"} mappings_scanned=${mappingRows.length} connectors_visible=${options.length}`,
    );
    return options;
  },
});

