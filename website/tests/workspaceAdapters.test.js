import { describe, expect, it } from "bun:test";

import { normalizeJournalTrades, summarizeJournalTrades } from "../app/workspace/lib/journalAdapter";
import { buildJournalAnalytics } from "../app/workspace/lib/journalMetrics";
import { groupLiveIntelByPanel, normalizeLiveIntelCards } from "../app/workspace/lib/liveIntelAdapter";
import { buildMarketKpis, normalizeMarketRows } from "../app/workspace/lib/marketAdapter";
import { normalizeNewsArticles, partitionFeaturedNews } from "../app/workspace/lib/newsAdapter";

describe("workspace adapters", () => {
  it("normalizes market rows with deterministic sorting and defaults", () => {
    const rows = normalizeMarketRows([
      { symbol: "eth", marketCap: 300, price: 2200, change24h: -1.2 },
      { symbol: "btc", marketCap: 1200, price: 67000, change24h: 1.8 },
      { symbol: "sol", marketCap: 1200, price: 130, change24h: 0.4 },
      { symbol: "" },
    ]);

    expect(rows.map((row) => row.symbol)).toEqual(["BTC", "SOL", "ETH"]);
    expect(rows[0].sparkline7d).toEqual([]);
    const kpis = buildMarketKpis(rows);
    expect(kpis.totalMarketCap).toBe(2700);
    expect(kpis.avgChange24h).toBeCloseTo(1 / 3, 10);
    expect(kpis.gainers).toBe(2);
    expect(kpis.losers).toBe(1);
  });

  it("returns empty structures for empty adapter input", () => {
    expect(normalizeMarketRows(null)).toEqual([]);
    expect(normalizeLiveIntelCards(undefined)).toEqual([]);
    expect(normalizeJournalTrades([])).toEqual([]);
    expect(normalizeNewsArticles([])).toEqual([]);
  });

  it("normalizes live intel cards and groups by panel", () => {
    const cards = normalizeLiveIntelCards([
      { title: "Funding", panel: "funding", changePct: 0.2, timeframe: "5m", sentiment: "bullish" },
      { title: "Movers", panel: "movers", changePct: 5.1, timeframe: "15m", sentiment: "bearish" },
      { title: "Open Interest", panel: "oi", changePct: -2.4, timeframe: "1h", sentiment: "neutral" },
    ]);

    expect(cards.map((card) => card.title)).toEqual(["Movers", "Open Interest", "Funding"]);
    const grouped = groupLiveIntelByPanel(cards);
    expect(Object.keys(grouped).sort()).toEqual(["funding", "movers", "oi"]);
  });

  it("normalizes journal trades and computes summary", () => {
    const trades = normalizeJournalTrades([
      { symbol: "btcusdt", status: "closed", pnl: 250, openedAt: 200 },
      { symbol: "solusdt", status: "open", pnl: -20, openedAt: 500 },
      { symbol: "ethusdt", status: "closed", pnl: -50, openedAt: 300 },
    ]);

    expect(trades.map((trade) => trade.symbol)).toEqual(["SOLUSDT", "ETHUSDT", "BTCUSDT"]);
    expect(summarizeJournalTrades(trades)).toEqual({
      total: 3,
      openCount: 1,
      closedCount: 2,
      netPnl: 180,
      winRate: 0.5,
    });

    const analytics = buildJournalAnalytics(trades);
    expect(analytics.profitFactor).toBe(5);
    expect(analytics.expectancy).toBe(100);
    expect(analytics.bestTrade).toBe(250);
    expect(analytics.maxDrawdown).toBe(-50);
    expect(analytics.equityPoints).toHaveLength(2);
    expect(analytics.dailyPnl).toHaveLength(1);
  });

  it("normalizes and partitions news with featured precedence", () => {
    const news = normalizeNewsArticles([
      { title: "B", source: "X", url: "https://x.test/b", publishedAt: 100 },
      { title: "A", source: "X", url: "https://x.test/a", publishedAt: 900, featured: true },
      { title: "C", source: "X", url: "https://x.test/c", publishedAt: 600 },
    ]);

    const partitioned = partitionFeaturedNews(news);
    expect(partitioned.featured?.title).toBe("A");
    expect(partitioned.rest.map((article) => article.title)).toEqual(["C", "B"]);
  });
});
