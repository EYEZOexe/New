"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/workspace/chart-card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import type { MarketInstrument } from "../lib/types";
import { buildMarketKpis, normalizeMarketRows } from "../lib/marketAdapter";
import { MarketsKpiRow } from "./components/markets-kpi-row";
import { MarketsTable } from "./components/markets-table";

const listMarketSnapshotsRef = makeFunctionReference<
  "query",
  { limit?: number },
  Array<{
    _id: string;
    symbol: string;
    name: string;
    price: number;
    change1h: number;
    change24h: number;
    marketCap: number;
    volume24h: number;
    fundingRate?: number;
    high24h?: number;
    low24h?: number;
    sparkline7d?: number[];
    updatedAt: number;
  }>
>("workspace:listMarketSnapshots");

export default function MarketsPage() {
  const marketRows = useQuery(listMarketSnapshotsRef, { limit: 100 });
  const normalizedRows: MarketInstrument[] = normalizeMarketRows(
    (marketRows ?? []).map((row) => ({
      id: row._id,
      symbol: row.symbol,
      name: row.name,
      price: row.price,
      change1h: row.change1h,
      change24h: row.change24h,
      marketCap: row.marketCap,
      volume24h: row.volume24h,
      sparkline7d: row.sparkline7d ?? [],
    })),
  );
  const kpis = buildMarketKpis(normalizedRows);
  const topRows = normalizedRows.slice(0, 3);

  return (
    <>
      <WorkspaceSectionHeader
        title="Markets"
        description="Track market structure with a compact universe snapshot and quick direction context."
        actions={
          <Badge variant="outline" className="rounded-full">
            Source: CoinGecko
          </Badge>
        }
      />

      <MarketsKpiRow
        totalMarketCap={kpis.totalMarketCap}
        avgChange24h={kpis.avgChange24h}
        gainers={kpis.gainers}
        losers={kpis.losers}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {topRows.length > 0 ? (
          topRows.map((row) => (
            <ChartCard key={row.id} title={`${row.symbol} 7D`} values={row.sparkline7d ?? []} />
          ))
        ) : (
          <Card className="site-panel lg:col-span-3">
            <CardContent className="px-0 py-6 text-sm text-muted-foreground">
              No live market chart series are available yet.
            </CardContent>
          </Card>
        )}
      </div>

      {marketRows === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading market snapshots...
          </CardContent>
        </Card>
      ) : (
        <MarketsTable rows={normalizedRows} />
      )}
    </>
  );
}
