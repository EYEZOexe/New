import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { normalizeNewsArticles, partitionFeaturedNews } from "../lib/newsAdapter";
import { SymbolQuickViewDialog } from "../components/symbol-quick-view-dialog";
import { NewsFeatureCard } from "./components/news-feature-card";
import { NewsGrid } from "./components/news-grid";

const newsRows = normalizeNewsArticles([
  {
    id: "n-1",
    source: "CoinDesk",
    title: "Crypto slides as tech stocks and gold retreat; bitcoin correlation turns positive",
    url: "https://www.coindesk.com/",
    category: "featured",
    featured: true,
    publishedAt: Date.now() - 10 * 60 * 1000,
  },
  {
    id: "n-2",
    source: "CryptoNews",
    title: "Germany central bank president endorses crypto stablecoins under EU MiCA framework",
    url: "https://cryptonews.com/",
    category: "regulation",
    publishedAt: Date.now() - 23 * 60 * 1000,
  },
  {
    id: "n-3",
    source: "Cointelegraph",
    title: "Steak 'n Shake says same-store sales rose after bitcoin rollout",
    url: "https://cointelegraph.com/",
    category: "market",
    publishedAt: Date.now() - 38 * 60 * 1000,
  },
  {
    id: "n-4",
    source: "CryptoPotato",
    title: "Matrixport: Crypto extreme fear suggests incoming inflection point",
    url: "https://cryptopotato.com/",
    category: "update",
    publishedAt: Date.now() - 16 * 60 * 1000,
  },
  {
    id: "n-5",
    source: "Watcher Guru",
    title: "Monero use holds despite delistings as darknet markets shift",
    url: "https://watcher.guru/",
    category: "market",
    publishedAt: Date.now() - 2 * 60 * 60 * 1000,
  },
]);

export default function NewsPage() {
  const partitioned = partitionFeaturedNews(newsRows);
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

      {featured ? <NewsFeatureCard article={featured} /> : null}

      <NewsGrid articles={partitioned.rest} />
    </>
  );
}

