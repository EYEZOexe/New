"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import { Bell, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { AnalystFeed } from "./components/analyst-feed";

const viewerRef = makeFunctionReference<
  "query",
  Record<string, never>,
  {
    userId: string;
    email: string | null;
    name: string | null;
    tier: "basic" | "advanced" | "pro" | null;
    subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
    subscriptionEndsAt: number | null;
    hasSignalAccess: boolean;
  } | null
>("users:viewer");

const listRecentSignalsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string; limit?: number },
  Array<{
    _id: string;
    createdAt: number;
    sourceChannelId: string;
    content: string;
    attachments?: Array<{
      url: string;
      contentType?: string;
    }>;
  }>
>("signals:listRecent");

function formatAge(timestamp: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function findImageAttachment(signal: { attachments?: Array<{ url: string; contentType?: string }> }): string | undefined {
  const attachment = signal.attachments?.find((entry) => {
    const type = entry.contentType?.toLowerCase() ?? "";
    return type.startsWith("image/");
  });
  return attachment?.url;
}

export default function SignalsPage() {
  const [tenantKey, setTenantKey] = useState("t1");
  const [connectorId, setConnectorId] = useState("conn_01");

  const viewer = useQuery(viewerRef, {});
  const signals = useQuery(listRecentSignalsRef, {
    tenantKey,
    connectorId,
    limit: 50,
  });

  const feedItems = useMemo(
    () =>
      (signals ?? []).map((signal) => ({
        id: signal._id,
        analyst: signal.sourceChannelId,
        handle: `@${signal.sourceChannelId}`,
        timeAgo: formatAge(signal.createdAt),
        content: signal.content || "(No text content)",
        imageUrl: findImageAttachment(signal),
      })),
    [signals],
  );
  const analysts = Array.from(new Set(feedItems.map((item) => item.analyst)));

  return (
    <>
      <WorkspaceSectionHeader
        title="Signals & Alerts"
        description="Follow analyst signal flow, volatility alerts, and desk-level updates in one feed."
        actions={
          <Badge variant="outline" className="rounded-full border-emerald-500/40 text-emerald-300">
            <Bell className="size-3" />
            Live updates
          </Badge>
        }
      />

      <Card className="site-soft">
        <CardContent className="flex items-center justify-between gap-3 px-0">
          <div>
            <p className="font-semibold">Notification Settings</p>
            <p className="text-sm text-muted-foreground">All notifications currently off.</p>
          </div>
          <Badge variant="outline">
            <Zap className="size-3" />
            Configure
          </Badge>
        </CardContent>
      </Card>

      <Card className="site-soft">
        <CardContent className="grid gap-3 px-0 md:grid-cols-2">
          <Input
            value={tenantKey}
            onChange={(event) => setTenantKey(event.target.value)}
            placeholder="Tenant key"
            className="h-10 rounded-xl bg-background/60"
          />
          <Input
            value={connectorId}
            onChange={(event) => setConnectorId(event.target.value)}
            placeholder="Connector id"
            className="h-10 rounded-xl bg-background/60"
          />
        </CardContent>
      </Card>

      {signals === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading analyst feed...
          </CardContent>
        </Card>
      ) : viewer && !viewer.hasSignalAccess ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Signal access is gated by subscription status.
          </CardContent>
        </Card>
      ) : (
        <AnalystFeed analysts={analysts} items={feedItems} />
      )}
    </>
  );
}
