"use client";

import { useEffect } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LiveIntelCard } from "@/app/workspace/lib/types";
import { cn } from "@/lib/utils";

type LiveIntelGridProps = {
  groupedCards: Record<string, LiveIntelCard[]>;
};

export function LiveIntelGrid(props: LiveIntelGridProps) {
  const groups = Object.entries(props.groupedCards);
  const [timeframeFilter, setTimeframeFilter] = useState<LiveIntelCard["timeframe"]>("1h");

  useEffect(() => {
    const itemCount = groups.reduce((count, [, cards]) => count + cards.length, 0);
    console.info(`[workspace/live-intel] groups=${groups.length} items=${itemCount}`);
  }, [groups]);

  if (groups.length === 0) {
    return (
      <Card className="site-panel">
        <CardContent className="px-0 py-6 text-sm text-muted-foreground">
          No live intel panels are available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {groups.map(([group, cards]) => (
        <Card key={group} className="site-panel h-full">
          <CardHeader className="space-y-3 px-0 pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base capitalize">{group.replaceAll("-", " ")}</CardTitle>
              <Badge variant="outline">{cards.filter((card) => card.timeframe === timeframeFilter).length || cards.length}</Badge>
            </div>
            <Tabs value={timeframeFilter} onValueChange={(value) => setTimeframeFilter(value as LiveIntelCard["timeframe"])}>
              <TabsList className="w-full">
                <TabsTrigger value="5m">5m</TabsTrigger>
                <TabsTrigger value="15m">15m</TabsTrigger>
                <TabsTrigger value="1h">1h</TabsTrigger>
                <TabsTrigger value="4h">4h</TabsTrigger>
                <TabsTrigger value="1d">1d</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent className="space-y-2 px-0">
            {(cards.filter((card) => card.timeframe === timeframeFilter).length
              ? cards.filter((card) => card.timeframe === timeframeFilter)
              : cards
            ).map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-2.5 transition-colors hover:border-primary/45 hover:bg-background/55"
              >
                <div>
                  <p className="font-semibold">{card.title}</p>
                  <p className="text-xs text-muted-foreground">{card.timeframe}</p>
                </div>
                <div className="text-right">
                  <p className={card.changePct >= 0 ? "text-emerald-300" : "text-red-300"}>
                    {card.changePct >= 0 ? "+" : ""}
                    {card.changePct.toFixed(2)}%
                  </p>
                  <p className={cn("text-[11px] capitalize", card.sentiment === "bullish" ? "text-emerald-300" : card.sentiment === "bearish" ? "text-red-300" : "text-muted-foreground")}>
                    {card.sentiment}
                  </p>
                </div>
              </div>
            ))}
            {cards.filter((card) => card.timeframe === timeframeFilter).length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                No cards in {timeframeFilter} for this panel. Showing latest available timeframe.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
