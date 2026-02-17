import { DashboardHeader } from "@/app/dashboard/components/DashboardHeader";
import { DashboardOverview } from "@/app/dashboard/components/DashboardOverview";

import type { OverviewControllerState } from "../useOverviewController";

type OverviewHeroProps = {
  overview: OverviewControllerState;
};

export function OverviewHero(props: OverviewHeroProps) {
  const overview = props.overview;

  return (
    <>
      <DashboardHeader isLoggingOut={overview.isLoggingOut} onLogout={() => void overview.onLogout()} />

      <DashboardOverview
        viewer={overview.viewer}
        hasSignalAccess={overview.hasSignalAccess}
        remainingText={overview.remainingText}
        hasRemainingTime={overview.hasRemainingTime}
        configuredVisibleCount={overview.configuredVisibleMappings.length}
        visibleMappingsCount={overview.visibleMappingsForTier.length}
        lockedMappings={overview.lockedMappings}
        viewerDiscordLink={overview.viewerDiscordLink}
        isDiscordLinked={overview.isDiscordLinked}
        isCompletingDiscordLink={overview.isCompletingDiscordLink}
        isUnlinkingDiscord={overview.isUnlinkingDiscord}
        onStartDiscordLink={overview.onStartDiscordLink}
        onUnlinkDiscord={() => void overview.onUnlinkDiscord()}
        discordStatusMessage={overview.discordStatusMessage}
        discordErrorMessage={overview.discordErrorMessage}
      />
    </>
  );
}

