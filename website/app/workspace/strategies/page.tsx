"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";

import { Badge } from "@/components/ui/badge";
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
  const strategies = (strategyRows ?? []).map((row) => ({
    id: row._id,
    analyst: row.analyst,
    strategy: row.strategy,
    description: row.description,
    tags: row.tags ?? [],
    sections: row.sections ?? [],
  }));

  return (
    <>
      <WorkspaceSectionHeader
        title="Strategies"
        description="Analyst playbooks and execution frameworks with tactical filtering."
      />

      <Card className="site-soft">
        <CardContent className="flex flex-wrap items-center gap-2 px-0">
          <Badge variant="outline">All Strategies</Badge>
          <Badge variant="outline">Scalping</Badge>
          <Badge variant="outline">Swing</Badge>
          <Badge variant="outline">Breakout</Badge>
          <Badge variant="outline">Reversal</Badge>
        </CardContent>
      </Card>

      {strategyRows === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading strategy library...
          </CardContent>
        </Card>
      ) : (
        <StrategyList items={strategies} />
      )}
    </>
  );
}
