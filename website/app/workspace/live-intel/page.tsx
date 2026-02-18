"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { groupLiveIntelByPanel, normalizeLiveIntelCards } from "../lib/liveIntelAdapter";
import { LiveIntelGrid } from "./components/live-intel-grid";

const listLiveIntelItemsRef = makeFunctionReference<
  "query",
  { limit?: number },
  Array<{
    _id: string;
    panel: string;
    title: string;
    value: number;
    changePct: number;
    timeframe: "5m" | "15m" | "1h" | "4h" | "1d";
    sentiment: "bullish" | "bearish" | "neutral";
    updatedAt: number;
  }>
>("workspace:listLiveIntelItems");

export default function LiveIntelPage() {
  const liveItems = useQuery(listLiveIntelItemsRef, { limit: 150 });
  const cards = normalizeLiveIntelCards(
    (liveItems ?? []).map((item) => ({
      id: item._id,
      panel: item.panel,
      title: item.title,
      value: item.value,
      changePct: item.changePct,
      timeframe: item.timeframe,
      sentiment: item.sentiment,
    })),
  );
  const groupedCards = groupLiveIntelByPanel(cards);

  return (
    <>
      <WorkspaceSectionHeader
        title="Live Intel"
        description="Realtime market analysis widgets with fast timeframe pivots and panel-level signal grouping."
        actions={
          <Badge variant="outline" className="rounded-full border-emerald-500/40 text-emerald-300">
            Live data • 2m refresh
          </Badge>
        }
      />

      {liveItems === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading live intel panels...
          </CardContent>
        </Card>
      ) : (
        <LiveIntelGrid groupedCards={groupedCards} />
      )}
    </>
  );
}
