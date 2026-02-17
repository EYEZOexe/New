"use client";

import { PageFrame } from "@/components/site/page-frame";
import { Card, CardContent } from "@/components/ui/card";

import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardOverview } from "./components/DashboardOverview";
import { DashboardSignalsFeed } from "./components/DashboardSignalsFeed";
import { useDashboardController } from "./useDashboardController";

export default function DashboardPage() {
  const dashboard = useDashboardController();

  if (dashboard.isLoading) {
    return (
      <PageFrame>
        <Card className="site-panel">
          <CardContent className="px-0">
            <p className="text-sm text-muted-foreground">Checking session...</p>
          </CardContent>
        </Card>
      </PageFrame>
    );
  }

  if (!dashboard.isAuthenticated) {
    return null;
  }

  return (
    <PageFrame>
      <DashboardHeader isLoggingOut={dashboard.isLoggingOut} onLogout={() => void dashboard.onLogout()} />

      <DashboardOverview
        viewer={dashboard.viewer}
        hasSignalAccess={dashboard.hasSignalAccess}
        remainingText={dashboard.remainingText}
        hasRemainingTime={dashboard.hasRemainingTime}
        configuredVisibleCount={dashboard.configuredVisibleMappings.length}
        visibleMappingsCount={dashboard.visibleMappingsForTier.length}
        lockedMappings={dashboard.lockedMappings}
        viewerDiscordLink={dashboard.viewerDiscordLink}
        isDiscordLinked={dashboard.isDiscordLinked}
        isCompletingDiscordLink={dashboard.isCompletingDiscordLink}
        isUnlinkingDiscord={dashboard.isUnlinkingDiscord}
        onStartDiscordLink={dashboard.onStartDiscordLink}
        onUnlinkDiscord={() => void dashboard.onUnlinkDiscord()}
        discordStatusMessage={dashboard.discordStatusMessage}
        discordErrorMessage={dashboard.discordErrorMessage}
      />

      <DashboardSignalsFeed
        signals={dashboard.signals}
        tenantKey={dashboard.tenantKey}
        connectorId={dashboard.connectorId}
        onTenantKeyChange={dashboard.setTenantKey}
        onConnectorIdChange={dashboard.setConnectorId}
        signalState={dashboard.signalState}
      />
    </PageFrame>
  );
}
