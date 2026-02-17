import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { IndicatorPanels } from "./components/indicator-panels";

const oracleAlerts = [
  { id: "o-1", title: "4H Bullish Delta Volume", side: "bull" as const, timeframe: "4H", price: "$77,716", date: "02/02/2026" },
  { id: "o-2", title: "4H Bearish Delta Volume", side: "bear" as const, timeframe: "4H", price: "$81,269", date: "31/01/2026" },
  { id: "o-3", title: "1H Bullish FVG Reclaim", side: "bull" as const, timeframe: "1H", price: "$68,112", date: "30/01/2026" },
];

const watchlistAlerts = [
  { id: "w-1", title: "BTC 15M Bearish Structure Break", side: "bear" as const, timeframe: "15M", price: "$78,343", date: "03/02/2026" },
  { id: "w-2", title: "15M Bullish Structure Break", side: "bull" as const, timeframe: "15M", price: "$78,854", date: "03/02/2026" },
  { id: "w-3", title: "ETH 1H Bearish Continuation", side: "bear" as const, timeframe: "1H", price: "$2,612", date: "02/02/2026" },
];

export default function IndicatorsPage() {
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

      <IndicatorPanels oracleAlerts={oracleAlerts} watchlistAlerts={watchlistAlerts} />
    </>
  );
}

