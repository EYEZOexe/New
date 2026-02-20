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
      connectorOptions={overview.connectorOptions}
      selectedConnectorValue={overview.selectedConnectorValue}
      onConnectorSelectionChange={overview.onConnectorSelectionChange}
      tenantKey={overview.tenantKey}
      connectorId={overview.connectorId}
      signalState={overview.signalState}
    />
  );
}
