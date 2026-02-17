import { Badge } from "@/components/ui/badge";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { groupLiveIntelByPanel, normalizeLiveIntelCards } from "../lib/liveIntelAdapter";
import { LiveIntelGrid } from "./components/live-intel-grid";

const mockIntelCards = normalizeLiveIntelCards([
  {
    id: "movers-1",
    panel: "market-movers",
    title: "JTO",
    value: 0.3218,
    changePct: 15.01,
    timeframe: "1h",
    sentiment: "bullish",
  },
  {
    id: "movers-2",
    panel: "market-movers",
    title: "ARIA",
    value: 0.0879,
    changePct: 8.09,
    timeframe: "1h",
    sentiment: "bullish",
  },
  {
    id: "volume-1",
    panel: "top-volume",
    title: "ORCA",
    value: 970500,
    changePct: 1.97,
    timeframe: "5m",
    sentiment: "bullish",
  },
  {
    id: "volume-2",
    panel: "top-volume",
    title: "APT",
    value: 200500,
    changePct: 0.23,
    timeframe: "5m",
    sentiment: "bullish",
  },
  {
    id: "funding-1",
    panel: "funding-rates",
    title: "PLAYSOUT",
    value: 0.0235,
    changePct: 0.29,
    timeframe: "15m",
    sentiment: "bullish",
  },
  {
    id: "funding-2",
    panel: "funding-rates",
    title: "MYX",
    value: 1.56,
    changePct: 0.09,
    timeframe: "15m",
    sentiment: "bullish",
  },
]);

export default function LiveIntelPage() {
  const groupedCards = groupLiveIntelByPanel(mockIntelCards);

  return (
    <>
      <WorkspaceSectionHeader
        title="Live Intel"
        description="Realtime market analysis widgets with fast timeframe pivots and panel-level signal grouping."
        actions={
          <Badge variant="outline" className="rounded-full border-emerald-500/40 text-emerald-300">
            Live data • 30s refresh
          </Badge>
        }
      />

      <LiveIntelGrid groupedCards={groupedCards} />
    </>
  );
}

