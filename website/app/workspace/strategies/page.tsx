"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [searchValue, setSearchValue] = useState("");
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
  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredStrategies = useMemo(() => {
    return strategies.filter((item) => {
      if (selectedTag !== "all" && !item.tags.includes(selectedTag)) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        item.analyst,
        item.strategy,
        item.description,
        ...item.tags,
        ...item.sections.map((section) => section.title),
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedSearch);
    });
  }, [normalizedSearch, selectedTag, strategies]);

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
        <CardContent className="space-y-3 px-0">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by analyst, strategy, or tag..."
            aria-label="Search strategy tags"
            className="h-10 rounded-full border-border/80 bg-background/70"
          />

          <div className="flex flex-wrap items-center gap-2">
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
          </div>
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
