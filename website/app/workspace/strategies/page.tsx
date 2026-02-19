"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { StrategyList } from "./components/strategy-list";

const listStrategiesRef = makeFunctionReference<
  "query",
  { activeOnly?: boolean; limit?: number },
  Array<{
    _id: string;
    analyst: string;
    strategy: string;
    description: string;
    tags?: string[];
    sections?: Array<{ title: string; body: string }>;
    active: boolean;
    updatedAt: number;
  }>
>("workspace:listStrategies");

export default function StrategiesPage() {
  const strategyRows = useQuery(listStrategiesRef, { activeOnly: true, limit: 100 });
  const [selectedTag, setSelectedTag] = useState("all");
  const strategies = (strategyRows ?? []).map((row) => ({
    id: row._id,
    analyst: row.analyst,
    strategy: row.strategy,
    description: row.description,
    tags: row.tags ?? [],
    sections: row.sections ?? [],
  }));
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const strategy of strategies) {
      for (const tag of strategy.tags) {
        tags.add(tag);
      }
    }
    return ["all", ...Array.from(tags).sort((left, right) => left.localeCompare(right))];
  }, [strategies]);
  const filteredStrategies = useMemo(
    () => (selectedTag === "all" ? strategies : strategies.filter((item) => item.tags.includes(selectedTag))),
    [selectedTag, strategies],
  );

  return (
    <>
      <WorkspaceSectionHeader
        title="Strategies"
        description="Analyst playbooks and execution frameworks with tactical filtering."
        actions={
          <Badge variant="outline" className="rounded-full">
            Active playbooks: {filteredStrategies.length}
          </Badge>
        }
      />

      <Card className="site-soft">
        <CardContent className="flex flex-wrap items-center gap-2 px-0">
          {availableTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="sm"
              variant={selectedTag === tag ? "default" : "outline"}
              className="rounded-full capitalize"
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </Button>
          ))}
        </CardContent>
      </Card>

      {strategyRows === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading strategy library...
          </CardContent>
        </Card>
      ) : (
        <StrategyList items={filteredStrategies} />
      )}
    </>
  );
}
