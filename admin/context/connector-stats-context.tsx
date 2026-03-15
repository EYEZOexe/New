"use client";

import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

type ConnectorHealth = {
  tenantKey: string;
  connectorId: string;
  failedJobs: number;
  pendingJobs: number;
  totalJobs: number;
};

type ConnectorStatsContextValue = {
  connectorHealth: ConnectorHealth[];
  // key format: `${tenantKey}::${connectorId}` (double-colon separator)
  failedJobsByConnector: Record<string, number>;
};

const ConnectorStatsContext = createContext<
  ConnectorStatsContextValue | undefined
>(undefined);

const getConnectorHealthSummaryRef = makeFunctionReference<
  "query",
  Record<string, never>,
  ConnectorHealth[]
>("connectors:getConnectorHealthSummary");

export function ConnectorStatsProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const healthData = useQuery(getConnectorHealthSummaryRef, {});

  const value = useMemo<ConnectorStatsContextValue>(() => {
    if (healthData === undefined) {
      return {
        connectorHealth: [],
        failedJobsByConnector: {},
      };
    }

    const failedJobsByConnector: Record<string, number> = {};
    healthData.forEach((health) => {
      const key = `${health.tenantKey}::${health.connectorId}`;
      failedJobsByConnector[key] = health.failedJobs;
    });

    return {
      connectorHealth: healthData,
      failedJobsByConnector,
    };
  }, [healthData]);

  return (
    <ConnectorStatsContext.Provider value={value}>
      {children}
    </ConnectorStatsContext.Provider>
  );
}

export function useConnectorStats(): ConnectorStatsContextValue {
  const context = useContext(ConnectorStatsContext);
  if (context === undefined) {
    throw new Error(
      "useConnectorStats must be used within a ConnectorStatsProvider"
    );
  }
  return context;
}
