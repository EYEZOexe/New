"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnalystFeedItem = {
  id: string;
  analystKey: string;
  analystName: string;
  handle: string;
  timeAgo: string;
  content: string;
  imageUrl?: string;
};

type AnalystFeedProps = {
  analysts: Array<{
    key: string;
    label: string;
  }>;
  items: AnalystFeedItem[];
};

export function AnalystFeed(props: AnalystFeedProps) {
  const [selectedAnalystKey, setSelectedAnalystKey] = useState<string>("all");

  useEffect(() => {
    if (selectedAnalystKey === "all") return;
    if (props.analysts.some((analyst) => analyst.key === selectedAnalystKey)) return;
    setSelectedAnalystKey("all");
  }, [props.analysts, selectedAnalystKey]);

  const filteredItems = useMemo(() => {
    if (selectedAnalystKey === "all") return props.items;
    return props.items.filter((item) => item.analystKey === selectedAnalystKey);
  }, [props.items, selectedAnalystKey]);

  useEffect(() => {
    console.info(
      `[workspace/signals] filter=${selectedAnalystKey} total=${props.items.length} visible=${filteredItems.length}`,
    );
  }, [filteredItems.length, props.items.length, selectedAnalystKey]);

  return (
    <Card className="site-panel site-card-hover">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-0 pb-3">
        <CardTitle className="text-base">Analyst Feed</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedAnalystKey === "all" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setSelectedAnalystKey("all")}
          >
            All Analysts
          </Button>
          {props.analysts.map((analyst) => (
            <Button
              key={analyst.key}
              size="sm"
              variant={selectedAnalystKey === analyst.key ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setSelectedAnalystKey(analyst.key)}
            >
              {analyst.label}
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
                <p className="font-semibold">{item.analystName}</p>
                <p className="text-sm text-muted-foreground">{item.handle}</p>
              </div>
              <Badge variant="outline">{item.timeAgo}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground/95">{item.content}</p>
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={`${item.analystName} chart`}
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
