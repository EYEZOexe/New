import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import type { SignalRow, SignalState, ViewerConnectorOption } from "../types";
import { classifyAttachment, formatBytes, MAX_ATTACHMENT_BYTES } from "../utils";

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
        <AlertDescription>Loading signals...</AlertDescription>
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
        <AlertDescription>No recent signals in channels visible to your tier.</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function DashboardSignalsFeed(props: DashboardSignalsFeedProps) {
  return (
    <Card className="site-panel">
      <CardHeader className="px-0 pb-3">
        <CardTitle className="text-base">Signals</CardTitle>
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
          ? props.signals?.map((signal) => (
              <Card key={signal._id} className="site-soft overflow-hidden">
                <CardContent className="space-y-4 px-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{new Date(signal.createdAt).toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground">Signal ID: {signal._id}</p>
                    </div>
                    <Badge variant="outline" className="max-w-full break-all">
                      {signal.sourceGuildId} / {signal.sourceChannelId}
                    </Badge>
                  </div>
                  <p className="site-signal-text">{signal.content || "(No text content)"}</p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {signal.editedAt ? (
                      <Badge variant="outline">
                        Edited {new Date(signal.editedAt).toLocaleString()}
                      </Badge>
                    ) : null}
                    {signal.deletedAt ? (
                      <Badge variant="outline" className="border-red-400/50 text-red-200">
                        Deleted {new Date(signal.deletedAt).toLocaleString()}
                      </Badge>
                    ) : null}
                  </div>

                  {signal.attachments?.length ? (
                    <ul className="space-y-2">
                      {signal.attachments.map((attachment, index) => {
                        const meta = classifyAttachment(attachment);
                        const displayName = attachment.name?.trim() || `Attachment ${index + 1}`;
                        const key = `${signal._id}-a-${attachment.attachmentId ?? index}`;
                        const sizeText =
                          typeof attachment.size === "number"
                            ? formatBytes(attachment.size)
                            : "unknown size";
                        const typeText = meta.normalizedType || "unknown type";
                        const hideLink = meta.isBlockedType || !meta.isAllowedType;

                        return (
                          <li key={key} className="rounded-xl border border-border/70 bg-background/60 p-3 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{displayName}</span>
                              <Badge variant="outline">{typeText}</Badge>
                              <Badge variant="outline">{sizeText}</Badge>
                            </div>

                            {meta.isOversized ? (
                              <p className="mt-2 text-amber-200">
                                Attachment exceeds {formatBytes(MAX_ATTACHMENT_BYTES)} preview limit.
                              </p>
                            ) : null}
                            {meta.isBlockedType || !meta.isAllowedType ? (
                              <p className="mt-2 text-red-200">
                                Attachment type is blocked from inline rendering.
                              </p>
                            ) : null}

                            {!hideLink ? (
                              <a
                                className="mt-2 inline-block underline underline-offset-4"
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open attachment
                              </a>
                            ) : null}
                            {meta.canPreviewImage ? (
                              <img
                                src={attachment.url}
                                alt={displayName}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="mt-2 max-h-72 rounded-lg border border-border/70 object-contain"
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            ))
          : null}
      </CardContent>
    </Card>
  );
}
