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

export default function NewsPage() {
  const newsRows = useQuery(listNewsArticlesRef, { limit: 80 });
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
            <SymbolQuickViewDialog
              trigger={
                <Button variant="outline" className="rounded-full">
                  Quick View BTCUSDT
                </Button>
              }
              symbol="BTCUSDT"
              contract="Perpetual Contract"
              price={67781.6}
              changePct={-1.08}
              volume24h="$4.51B"
              fundingRate="0.0019%"
              high24h="$70,099.1"
              low24h="$67,243.6"
            />
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
