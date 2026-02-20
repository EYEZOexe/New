"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { normalizeNewsArticles, partitionFeaturedNews } from "../lib/newsAdapter";
import { SymbolQuickViewDialog } from "../components/symbol-quick-view-dialog";
import { NewsFeatureCard } from "./components/news-feature-card";
import { NewsGrid } from "./components/news-grid";

const listNewsArticlesRef = makeFunctionReference<
  "query",
  { limit?: number },
  Array<{
    _id: string;
    source: string;
    title: string;
    url: string;
    category: string;
    publishedAt: number;
    featured?: boolean;
    updatedAt: number;
  }>
>("workspace:listNewsArticles");

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

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatUsdCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function NewsPage() {
  const newsRows = useQuery(listNewsArticlesRef, { limit: 80 });
  const marketRows = useQuery(listMarketSnapshotsRef, { limit: 120 });
  const normalizedNews = normalizeNewsArticles(
    (newsRows ?? []).map((row) => ({
      id: row._id,
      source: row.source,
      title: row.title,
      url: row.url,
      category: row.category,
      publishedAt: row.publishedAt,
      featured: row.featured ?? false,
    })),
  );
  const partitioned = partitionFeaturedNews(normalizedNews);
  const featured = partitioned.featured;
  const quickViewRow =
    (marketRows ?? []).find((row) => row.symbol.toUpperCase() === "BTC") ??
    (marketRows ?? [])[0];

  return (
    <>
      <WorkspaceSectionHeader
        title="Market Intelligence"
        description="Realtime updates from top crypto sources with source-level filtering and featured prioritization."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-emerald-500/40 text-emerald-300">
              Live
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Source: CryptoCompare
            </Badge>
            {quickViewRow ? (
              <SymbolQuickViewDialog
                trigger={
                  <Button variant="outline" className="rounded-full">
                    Quick View {quickViewRow.symbol.toUpperCase()}
                  </Button>
                }
                symbol={quickViewRow.symbol.toUpperCase()}
                contract={quickViewRow.name}
                price={quickViewRow.price}
                changePct={quickViewRow.change24h}
                volume24h={formatUsdCompact(quickViewRow.volume24h)}
                fundingRate={
                  typeof quickViewRow.fundingRate === "number"
                    ? `${quickViewRow.fundingRate.toFixed(4)}%`
                    : "n/a"
                }
                high24h={formatUsd(quickViewRow.high24h ?? quickViewRow.price)}
                low24h={formatUsd(quickViewRow.low24h ?? quickViewRow.price)}
              />
            ) : null}
          </div>
        }
      />

      {newsRows === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading market intelligence feed...
          </CardContent>
        </Card>
      ) : (
        <>
          {featured ? <NewsFeatureCard article={featured} /> : null}
          <NewsGrid articles={partitioned.rest} />
        </>
      )}
    </>
  );
}
