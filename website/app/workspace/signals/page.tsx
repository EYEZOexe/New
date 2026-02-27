"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import { Bell, Zap } from "lucide-react";
import { useMemo } from "react";

import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useViewerConnectorSelection } from "@/app/workspace/lib/useViewerConnectorSelection";

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
    sourceChannelName?: string;
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

function resolveChannelName(signal: { sourceChannelName?: string }): string {
  const name = signal.sourceChannelName?.trim() ?? "";
  return name || "Unknown channel";
}

export default function SignalsPage() {
  const viewer = useQuery(viewerRef, {});
  const hasSignalAccess = viewer?.hasSignalAccess === true;
  const {
    connectorOptions,
    selectionValue,
    tenantKey,
    connectorId,
    setSelectionByValue,
  } = useViewerConnectorSelection(hasSignalAccess);
  const signals = useQuery(
    listRecentSignalsRef,
    hasSignalAccess && tenantKey && connectorId ? { tenantKey, connectorId, limit: 50 } : "skip",
  );

  const feedItems = useMemo(
    () =>
      (signals ?? []).map((signal) => ({
        id: signal._id,
        analystKey: signal.sourceChannelId,
        analystName: resolveChannelName(signal),
        handle: `#${resolveChannelName(signal)}`,
        timeAgo: formatAge(signal.createdAt),
        content: signal.content || "(No text content)",
        imageUrl: findImageAttachment(signal),
      })),
    [signals],
  );
  const analysts = Array.from(
    new Map(feedItems.map((item) => [item.analystKey, item.analystName])).entries(),
  ).map(([key, label]) => ({ key, label }));

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
          <div className="space-y-2">
            <Label htmlFor="signals-connector-select" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Signal source
            </Label>
            <NativeSelect
              id="signals-connector-select"
              value={selectionValue}
              className="h-10 w-full rounded-xl bg-background/60"
              onChange={(event) => setSelectionByValue(event.target.value)}
              disabled={!connectorOptions || connectorOptions.length === 0}
              aria-label="Select connector source"
            >
              {!connectorOptions ? (
                <NativeSelectOption value="">Loading connector sources...</NativeSelectOption>
              ) : null}
              {connectorOptions?.length === 0 ? (
                <NativeSelectOption value="">No visible connector sources configured</NativeSelectOption>
              ) : null}
              {connectorOptions?.map((option) => {
                const value = `${option.tenantKey}::${option.connectorId}`;
                const label = `${option.tenantKey} / ${option.connectorId} (${option.visibleChannelCount} visible)`;
                return (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                );
              })}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Selected context</p>
            <div className="h-10 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm">
              {tenantKey && connectorId
                ? `${tenantKey} / ${connectorId}`
                : "No connector context selected"}
            </div>
          </div>
        </CardContent>
      </Card>

      {viewer && !viewer.hasSignalAccess ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Signal access is gated by subscription status.
          </CardContent>
        </Card>
      ) : connectorOptions === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading connector visibility...
          </CardContent>
        </Card>
      ) : connectorOptions.length === 0 ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            No dashboard-visible connector channels are configured for your tier.
          </CardContent>
        </Card>
      ) : signals === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading analyst feed...
          </CardContent>
        </Card>
      ) : (
        <AnalystFeed analysts={analysts} items={feedItems} />
      )}
    </>
  );
}
