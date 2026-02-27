import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import type { SignalRow, SignalState, ViewerConnectorOption } from "../types";

type DashboardSignalsFeedProps = {
  signals: SignalRow[] | undefined;
  connectorOptions: ViewerConnectorOption[] | undefined;
  selectedConnectorValue: string;
  onConnectorSelectionChange: (value: string) => void;
  tenantKey: string;
  connectorId: string;
  signalState: SignalState;
};

function EmptyState(props: { signalState: SignalState }) {
  if (props.signalState === "no_access") {
    return (
      <Alert>
        <AlertDescription>Access is currently gated by subscription status.</AlertDescription>
      </Alert>
    );
  }
  if (props.signalState === "loading") {
    return (
      <Alert>
        <AlertDescription>Loading notifications...</AlertDescription>
      </Alert>
    );
  }
  if (props.signalState === "no_visible_config") {
    return (
      <Alert>
        <AlertDescription>No channels are configured for dashboard visibility yet.</AlertDescription>
      </Alert>
    );
  }
  if (props.signalState === "tier_locked") {
    return (
      <Alert className="border-amber-400/40 bg-amber-500/10">
        <AlertDescription className="text-amber-100/90">
          Your tier does not include the currently visible channels.{" "}
          <Link href="/shop" className="underline underline-offset-4">
            Upgrade in shop
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }
  if (props.signalState === "empty") {
    return (
      <Alert>
        <AlertDescription>No recent notifications in channels visible to your tier.</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function summarizeContent(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "(No text content)";
  if (trimmed.length <= 220) return trimmed;
  return `${trimmed.slice(0, 217)}...`;
}

function describeEvent(signal: SignalRow): { label: string; tone: "default" | "outline" } {
  if (typeof signal.deletedAt === "number") {
    return { label: "Signal deleted", tone: "outline" };
  }
  if (typeof signal.editedAt === "number") {
    return { label: "Signal updated", tone: "outline" };
  }
  return { label: "New signal", tone: "default" };
}

export function DashboardSignalsFeed(props: DashboardSignalsFeedProps) {
  return (
    <Card className="site-panel site-card-hover">
      <CardHeader className="px-0 pb-3">
        <CardTitle className="text-base">Recent Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        <div className="site-soft grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="connector-select" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Signal source
            </Label>
            <NativeSelect
              id="connector-select"
              value={props.selectedConnectorValue}
              className="h-10 w-full rounded-xl bg-background/60"
              onChange={(event) => props.onConnectorSelectionChange(event.target.value)}
              disabled={!props.connectorOptions || props.connectorOptions.length === 0}
              aria-label="Select visible connector source"
            >
              {!props.connectorOptions ? (
                <NativeSelectOption value="">Loading connector sources...</NativeSelectOption>
              ) : null}
              {props.connectorOptions?.length === 0 ? (
                <NativeSelectOption value="">No visible connector sources configured</NativeSelectOption>
              ) : null}
              {props.connectorOptions?.map((option) => {
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
              {props.tenantKey && props.connectorId
                ? `${props.tenantKey} / ${props.connectorId}`
                : "No connector context selected"}
            </div>
          </div>
        </div>

        {props.signalState !== "has_signals" ? <EmptyState signalState={props.signalState} /> : null}

        {props.signalState === "has_signals"
          ? props.signals?.map((signal) => {
              const sourceLabel = signal.sourceChannelName?.trim()
                ? `#${signal.sourceChannelName}`
                : "Unknown channel";
              const event = describeEvent(signal);
              const attachmentCount = signal.attachments?.length ?? 0;
              return (
                <Card key={signal._id} className="site-soft site-card-hover overflow-hidden">
                  <CardContent className="space-y-3 px-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{sourceLabel}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={event.tone}>
                          {new Date(signal.deletedAt ?? signal.editedAt ?? signal.createdAt).toLocaleString()}
                        </Badge>
                        {attachmentCount > 0 ? (
                          <Badge variant="outline">{attachmentCount} attachments</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="site-signal-text">{summarizeContent(signal.content)}</p>
                  </CardContent>
                </Card>
              );
            })
          : null}

        <div className="rounded-xl border border-border/70 bg-background/45 p-3 text-xs text-muted-foreground">
          Need full signal context? Open{" "}
          <Link href="/workspace/signals" className="underline underline-offset-4">
            Signals &amp; Alerts
          </Link>
          .
        </div>
      </CardContent>
    </Card>
  );
}
