import { DashboardSignalsFeed } from "@/app/dashboard/components/DashboardSignalsFeed";

import type { OverviewControllerState } from "../useOverviewController";

type OverviewSignalFeedProps = {
  overview: OverviewControllerState;
};

export function OverviewSignalFeed(props: OverviewSignalFeedProps) {
  const overview = props.overview;

  return (
    <DashboardSignalsFeed
      signals={overview.signals}
      tenantKey={overview.tenantKey}
      connectorId={overview.connectorId}
      onTenantKeyChange={overview.setTenantKey}
      onConnectorIdChange={overview.setConnectorId}
      signalState={overview.signalState}
    />
  );
}

