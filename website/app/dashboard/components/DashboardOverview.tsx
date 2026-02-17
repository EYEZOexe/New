import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { DiscordLinkRow, ViewerRow } from "../types";

type DashboardOverviewProps = {
  viewer: ViewerRow | null | undefined;
  hasSignalAccess: boolean;
  remainingText: string | null;
  hasRemainingTime: boolean;
  configuredVisibleCount: number;
  visibleMappingsCount: number;
  lockedMappings: number;
  viewerDiscordLink: DiscordLinkRow | null | undefined;
  isDiscordLinked: boolean;
  isCompletingDiscordLink: boolean;
  isUnlinkingDiscord: boolean;
  onStartDiscordLink: () => void;
  onUnlinkDiscord: () => void;
  discordStatusMessage: string | null;
  discordErrorMessage: string | null;
};

export function DashboardOverview(props: DashboardOverviewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="site-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Status: {props.viewer?.subscriptionStatus ?? "inactive"}</Badge>
            <Badge variant="outline">Tier: {props.viewer?.tier ?? "none"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Expires:{" "}
            {props.viewer?.subscriptionEndsAt
              ? new Date(props.viewer.subscriptionEndsAt).toLocaleString()
              : "n/a"}
          </p>
          <p className="text-sm text-muted-foreground">
            Time left:{" "}
            {props.hasRemainingTime
              ? props.remainingText
              : props.viewer?.subscriptionEndsAt
                ? "expired"
                : "n/a"}
          </p>
          {!props.hasSignalAccess ? (
            <Alert className="border-amber-400/40 bg-amber-500/10">
              <AlertDescription className="text-amber-100/90">
                Signal access is disabled until subscription becomes active.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className="site-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Badge variant="outline">Configured channels: {props.configuredVisibleCount}</Badge>
          <p className="text-sm text-muted-foreground">
            Available for your tier: {props.visibleMappingsCount}
            {props.lockedMappings > 0 ? ` (locked: ${props.lockedMappings})` : ""}
          </p>
          {props.lockedMappings > 0 ? (
            <Alert className="border-amber-400/40 bg-amber-500/10">
              <AlertDescription className="text-amber-100/90">
                Some channels are above your tier.{" "}
                <Link href="/shop" className="underline underline-offset-4">
                  Upgrade in shop
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className="site-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Discord Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            {props.isDiscordLinked
              ? `${props.viewerDiscordLink?.username ?? "Linked"} (${props.viewerDiscordLink?.discordUserId})`
              : "Not linked"}
          </p>
          {props.viewerDiscordLink?.linkedAt ? (
            <p className="text-sm text-muted-foreground">
              Linked {new Date(props.viewerDiscordLink.linkedAt).toLocaleString()}
            </p>
          ) : null}

          {props.discordStatusMessage ? (
            <Alert className="border-emerald-400/40 bg-emerald-500/10">
              <AlertDescription className="text-emerald-100/90">
                {props.discordStatusMessage}
              </AlertDescription>
            </Alert>
          ) : null}
          {props.discordErrorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{props.discordErrorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={props.onStartDiscordLink}
              disabled={props.isCompletingDiscordLink || props.isUnlinkingDiscord}
            >
              {props.isCompletingDiscordLink ? "Completing link..." : "Connect Discord"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={props.onUnlinkDiscord}
              disabled={!props.isDiscordLinked || props.isUnlinkingDiscord || props.isCompletingDiscordLink}
            >
              {props.isUnlinkingDiscord ? "Unlinking..." : "Unlink Discord"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
