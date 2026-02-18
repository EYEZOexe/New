"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { IndicatorPanels } from "./components/indicator-panels";

const listIndicatorAlertsRef = makeFunctionReference<
  "query",
  { panel?: "oracle" | "watchlist"; limit?: number },
  Array<{
    _id: string;
    panel: "oracle" | "watchlist";
    title: string;
    side: "bull" | "bear";
    timeframe: string;
    price: string;
    eventDate: string;
    live?: boolean;
    updatedAt: number;
  }>
>("workspace:listIndicatorAlerts");

export default function IndicatorsPage() {
  const alerts = useQuery(listIndicatorAlertsRef, { limit: 80 });
  const oracleAlerts = (alerts ?? [])
    .filter((row) => row.panel === "oracle")
    .map((row) => ({
      id: row._id,
      title: row.title,
      side: row.side,
      timeframe: row.timeframe,
      price: row.price,
      date: row.eventDate,
    }));
  const watchlistAlerts = (alerts ?? [])
    .filter((row) => row.panel === "watchlist")
    .map((row) => ({
      id: row._id,
      title: row.title,
      side: row.side,
      timeframe: row.timeframe,
      price: row.price,
      date: row.eventDate,
    }));

  return (
    <>
      <WorkspaceSectionHeader
        title="Indicators"
        description="Oracle-style alerts, watchlist structure shifts, and tactical signal grouping."
      />

      <Card className="site-panel">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-0">
          <div>
            <p className="text-xl font-semibold">OracleAlgo</p>
            <p className="text-sm text-muted-foreground">
              Advanced indicator overlays designed for fast setup confirmation and risk-aware execution.
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="rounded-full">Get Started</Button>
            <Button variant="outline" className="rounded-full">
              View Documentation
            </Button>
          </div>
          <Badge variant="outline">
            <Sparkles className="size-3" />
            Live
          </Badge>
        </CardContent>
      </Card>

      {alerts === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading indicator alerts...
          </CardContent>
        </Card>
      ) : (
        <IndicatorPanels oracleAlerts={oracleAlerts} watchlistAlerts={watchlistAlerts} />
      )}
    </>
  );
}
