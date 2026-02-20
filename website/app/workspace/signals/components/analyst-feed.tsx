"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnalystFeedItem = {
  id: string;
  analyst: string;
  handle: string;
  timeAgo: string;
  content: string;
  imageUrl?: string;
};

type AnalystFeedProps = {
  analysts: string[];
  items: AnalystFeedItem[];
};

export function AnalystFeed(props: AnalystFeedProps) {
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (selectedAnalyst === "all") return props.items;
    return props.items.filter((item) => item.analyst === selectedAnalyst);
  }, [props.items, selectedAnalyst]);

  useEffect(() => {
    console.info(
      `[workspace/signals] filter=${selectedAnalyst} total=${props.items.length} visible=${filteredItems.length}`,
    );
  }, [filteredItems.length, props.items.length, selectedAnalyst]);

  return (
    <Card className="site-panel site-card-hover">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-0 pb-3">
        <CardTitle className="text-base">Analyst Feed</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedAnalyst === "all" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setSelectedAnalyst("all")}
          >
            All Analysts
          </Button>
          {props.analysts.map((analyst) => (
            <Button
              key={analyst}
              size="sm"
              variant={selectedAnalyst === analyst ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setSelectedAnalyst(analyst)}
            >
              {analyst}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-0">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-background/45 p-4 text-sm text-muted-foreground">
            No analyst signals match the active filter.
          </div>
        ) : null}
        {filteredItems.map((item) => (
          <article key={item.id} className="site-card-hover rounded-2xl border border-border/70 bg-background/45 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{item.analyst}</p>
                <p className="text-sm text-muted-foreground">{item.handle}</p>
              </div>
              <Badge variant="outline">{item.timeAgo}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground/95">{item.content}</p>
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={`${item.analyst} chart`}
                className="mt-3 max-h-56 rounded-lg border border-border/70 object-cover"
                loading="lazy"
              />
            ) : null}
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
