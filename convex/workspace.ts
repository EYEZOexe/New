import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";

async function requireAuthenticatedUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  return userId;
}

const MarketSnapshotInput = v.object({
  symbol: v.string(),
  name: v.string(),
  price: v.number(),
  change1h: v.number(),
  change24h: v.number(),
  marketCap: v.number(),
  volume24h: v.number(),
  fundingRate: v.optional(v.number()),
  high24h: v.optional(v.number()),
  low24h: v.optional(v.number()),
  sparkline7d: v.optional(v.array(v.number())),
});

const LiveIntelItemInput = v.object({
  panel: v.string(),
  title: v.string(),
  value: v.number(),
  changePct: v.number(),
  timeframe: v.union(
    v.literal("5m"),
    v.literal("15m"),
    v.literal("1h"),
    v.literal("4h"),
    v.literal("1d"),
  ),
  sentiment: v.union(v.literal("bullish"), v.literal("bearish"), v.literal("neutral")),
});

const IndicatorAlertInput = v.object({
  panel: v.union(v.literal("oracle"), v.literal("watchlist")),
  title: v.string(),
  side: v.union(v.literal("bull"), v.literal("bear")),
  timeframe: v.string(),
  price: v.string(),
  eventDate: v.string(),
  live: v.optional(v.boolean()),
});

const NewsArticleInput = v.object({
  source: v.string(),
  title: v.string(),
  url: v.string(),
  category: v.string(),
  publishedAt: v.number(),
  featured: v.optional(v.boolean()),
});

const DEFAULT_MARKET_LIMIT = 80;
const DEFAULT_NEWS_LIMIT = 60;

type CoinGeckoMarketRow = {
  symbol?: string;
  name?: string;
  current_price?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h?: number;
  market_cap?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  sparkline_in_7d?: { price?: number[] };
};

type CryptoCompareNewsResponse = {
  Data?: Array<{
    title?: string;
    url?: string;
    categories?: string;
    published_on?: number;
    source_info?: { name?: string };
    source?: string;
  }>;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toUsdPrice(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
}

function toIsoDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function computeJournalTradePnlUsd(input: {
  direction: "long" | "short";
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  riskUsd: number;
  status: "open" | "closed";
  explicitPnlUsd?: number;
}): { pnlUsd: number; source: "explicit" | "computed" | "default_zero" } {
  if (typeof input.explicitPnlUsd === "number" && Number.isFinite(input.explicitPnlUsd)) {
    return { pnlUsd: Number(input.explicitPnlUsd.toFixed(2)), source: "explicit" };
  }

  if (input.status !== "closed" || typeof input.exitPrice !== "number" || input.riskUsd <= 0) {
    return { pnlUsd: 0, source: "default_zero" };
  }

  const riskPerUnit =
    input.direction === "long"
      ? input.entryPrice - input.stopLoss
      : input.stopLoss - input.entryPrice;
  if (!Number.isFinite(riskPerUnit) || riskPerUnit <= 0) {
    return { pnlUsd: 0, source: "default_zero" };
  }

  const rewardPerUnit =
    input.direction === "long"
      ? input.exitPrice - input.entryPrice
      : input.entryPrice - input.exitPrice;

  const computed = (rewardPerUnit / riskPerUnit) * input.riskUsd;
  if (!Number.isFinite(computed)) {
    return { pnlUsd: 0, source: "default_zero" };
  }

  return { pnlUsd: Number(computed.toFixed(2)), source: "computed" };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "sleep-crypto-console/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`fetch_failed_${response.status}_${url}`);
  }
  return (await response.json()) as T;
}

export const listMarketSnapshots = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    if (!userId) {
      console.info("[workspace/markets] blocked unauthenticated query");
      return [];
    }

    const limit = Math.max(1, Math.min(200, args.limit ?? 50));
    const recent = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(500);

    const latestBySymbol = new Map<string, (typeof recent)[number]>();
    for (const row of recent) {
      if (!latestBySymbol.has(row.symbol)) {
        latestBySymbol.set(row.symbol, row);
      }
    }

    const rows = Array.from(latestBySymbol.values())
      .sort((left, right) => {
        if (left.marketCap !== right.marketCap) return right.marketCap - left.marketCap;
        return left.symbol.localeCompare(right.symbol);
      })
      .slice(0, limit);

    console.info(`[workspace/markets] user=${String(userId)} returned=${rows.length}`);
    return rows;
  },
});

export const listLiveIntelItems = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    if (!userId) {
      console.info("[workspace/live-intel] blocked unauthenticated query");
      return [];
    }

    const limit = Math.max(1, Math.min(300, args.limit ?? 120));
    const rows = await ctx.db
      .query("liveIntelItems")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(limit);

    console.info(`[workspace/live-intel] user=${String(userId)} returned=${rows.length}`);
    return rows;
  },
});

export const listIndicatorAlerts = query({
  args: {
    panel: v.optional(v.union(v.literal("oracle"), v.literal("watchlist"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    if (!userId) {
      console.info("[workspace/indicators] blocked unauthenticated query");
      return [];
    }

    const limit = Math.max(1, Math.min(200, args.limit ?? 50));
    if (args.panel) {
      const rows = await ctx.db
        .query("indicatorAlerts")
        .withIndex("by_panel_updatedAt", (q) => q.eq("panel", args.panel!))
        .order("desc")
        .take(limit);

      console.info(
        `[workspace/indicators] user=${String(userId)} panel=${args.panel} returned=${rows.length}`,
      );
      return rows;
    }

    const oracleRows = await ctx.db
      .query("indicatorAlerts")
      .withIndex("by_panel_updatedAt", (q) => q.eq("panel", "oracle"))
      .order("desc")
      .take(limit);
    const watchlistRows = await ctx.db
      .query("indicatorAlerts")
      .withIndex("by_panel_updatedAt", (q) => q.eq("panel", "watchlist"))
      .order("desc")
      .take(limit);

    const rows = [...oracleRows, ...watchlistRows]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);

    console.info(`[workspace/indicators] user=${String(userId)} returned=${rows.length}`);
    return rows;
  },
});

export const listStrategies = query({
  args: {
    activeOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    if (!userId) {
      console.info("[workspace/strategies] blocked unauthenticated query");
      return [];
    }

    const limit = Math.max(1, Math.min(200, args.limit ?? 100));
    const activeOnly = args.activeOnly ?? true;
    if (activeOnly) {
      const rows = await ctx.db
        .query("strategyEntries")
        .withIndex("by_active_updatedAt", (q) => q.eq("active", true))
        .order("desc")
        .take(limit);
      console.info(`[workspace/strategies] user=${String(userId)} returned=${rows.length}`);
      return rows;
    }

    const rows = await ctx.db.query("strategyEntries").collect();
    rows.sort((left, right) => right.updatedAt - left.updatedAt);
    const sliced = rows.slice(0, limit);
    console.info(`[workspace/strategies] user=${String(userId)} returned=${sliced.length}`);
    return sliced;
  },
});

export const listNewsArticles = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    if (!userId) {
      console.info("[workspace/news] blocked unauthenticated query");
      return [];
    }

    const limit = Math.max(1, Math.min(200, args.limit ?? 60));
    const rows = await ctx.db
      .query("newsArticles")
      .withIndex("by_publishedAt")
      .order("desc")
      .take(limit);
    console.info(`[workspace/news] user=${String(userId)} returned=${rows.length}`);
    return rows;
  },
});

export const publicLandingSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const recentMarketRows = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(300);
    const latestBySymbol = new Map<string, (typeof recentMarketRows)[number]>();
    for (const row of recentMarketRows) {
      if (!latestBySymbol.has(row.symbol)) {
        latestBySymbol.set(row.symbol, row);
      }
    }
    const marketRows = Array.from(latestBySymbol.values());

    const topGainer =
      marketRows.length > 0
        ? marketRows.reduce((best, row) => (row.change24h > best.change24h ? row : best), marketRows[0])
        : null;
    const topVolume =
      marketRows.length > 0
        ? marketRows.reduce((best, row) => (row.volume24h > best.volume24h ? row : best), marketRows[0])
        : null;

    const latestNewsRows = await ctx.db
      .query("newsArticles")
      .withIndex("by_publishedAt")
      .order("desc")
      .take(3);

    const snapshot = {
      marketCount: marketRows.length,
      lastMarketUpdateAt: recentMarketRows[0]?.updatedAt ?? null,
      topGainer: topGainer
        ? {
            symbol: topGainer.symbol,
            change24h: topGainer.change24h,
            price: topGainer.price,
          }
        : null,
      topVolume: topVolume
        ? {
            symbol: topVolume.symbol,
            volume24h: topVolume.volume24h,
            change24h: topVolume.change24h,
          }
        : null,
      latestNews: latestNewsRows.map((row) => ({
        title: row.title,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt,
      })),
    };

    console.info(
      `[workspace/public] landing snapshot markets=${snapshot.marketCount} news=${snapshot.latestNews.length} top_gainer=${snapshot.topGainer?.symbol ?? "none"}`,
    );
    return snapshot;
  },
});

export const listJournalTrades = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    if (!userId) {
      console.info("[workspace/journal] blocked unauthenticated query");
      return [];
    }

    const limit = Math.max(1, Math.min(500, args.limit ?? 200));
    const rows = await ctx.db
      .query("journalTrades")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    console.info(`[workspace/journal] user=${String(userId)} returned=${rows.length}`);
    return rows;
  },
});

export const createJournalTrade = mutation({
  args: {
    coin: v.string(),
    direction: v.union(v.literal("long"), v.literal("short")),
    entryPrice: v.number(),
    exitPrice: v.optional(v.number()),
    stopLoss: v.number(),
    riskUsd: v.number(),
    takeProfits: v.optional(v.array(v.number())),
    pnlUsd: v.optional(v.number()),
    leverage: v.string(),
    setup: v.string(),
    executionGrade: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D")),
    status: v.union(v.literal("open"), v.literal("closed")),
    entryDate: v.string(),
    exitDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    if (!userId) {
      throw new Error("unauthenticated");
    }
    if (args.status === "closed" && !args.exitDate) {
      throw new Error("exit_date_required_for_closed_trade");
    }
    if (args.status === "closed" && typeof args.exitPrice !== "number") {
      throw new Error("exit_price_required_for_closed_trade");
    }

    const now = Date.now();
    const pnlResult = computeJournalTradePnlUsd({
      direction: args.direction,
      entryPrice: args.entryPrice,
      exitPrice: args.exitPrice,
      stopLoss: args.stopLoss,
      riskUsd: args.riskUsd,
      status: args.status,
      explicitPnlUsd: args.pnlUsd,
    });
    const tradeId = await ctx.db.insert("journalTrades", {
      userId,
      coin: args.coin.trim().toUpperCase(),
      direction: args.direction,
      entryPrice: args.entryPrice,
      ...(typeof args.exitPrice === "number" ? { exitPrice: args.exitPrice } : {}),
      stopLoss: args.stopLoss,
      riskUsd: args.riskUsd,
      ...(args.takeProfits ? { takeProfits: args.takeProfits } : {}),
      pnlUsd: pnlResult.pnlUsd,
      leverage: args.leverage.trim(),
      setup: args.setup.trim(),
      executionGrade: args.executionGrade,
      status: args.status,
      entryDate: args.entryDate.trim(),
      ...(args.exitDate ? { exitDate: args.exitDate.trim() } : {}),
      ...(args.notes ? { notes: args.notes.trim() } : {}),
      ...(args.tags ? { tags: args.tags.map((tag) => tag.trim()).filter(Boolean) } : {}),
      createdAt: now,
      updatedAt: now,
    });

    console.info(
      `[workspace/journal] created trade=${String(tradeId)} user=${String(userId)} coin=${args.coin.trim().toUpperCase()} status=${args.status} pnl_usd=${pnlResult.pnlUsd} pnl_source=${pnlResult.source}`,
    );
    return { ok: true as const, tradeId };
  },
});

export const upsertMarketSnapshots = internalMutation({
  args: {
    rows: v.array(MarketSnapshotInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const row of args.rows) {
      const existing = await ctx.db
        .query("marketSnapshots")
        .withIndex("by_symbol", (q) => q.eq("symbol", row.symbol))
        .first();

      const next = {
        symbol: row.symbol,
        name: row.name,
        price: row.price,
        change1h: row.change1h,
        change24h: row.change24h,
        marketCap: row.marketCap,
        volume24h: row.volume24h,
        ...(typeof row.fundingRate === "number" ? { fundingRate: row.fundingRate } : {}),
        ...(typeof row.high24h === "number" ? { high24h: row.high24h } : {}),
        ...(typeof row.low24h === "number" ? { low24h: row.low24h } : {}),
        ...(row.sparkline7d?.length ? { sparkline7d: row.sparkline7d } : {}),
        updatedAt: now,
      };

      if (!existing) {
        await ctx.db.insert("marketSnapshots", next);
        inserted += 1;
      } else {
        await ctx.db.patch(existing._id, next);
        updated += 1;
      }
    }

    console.info(
      `[workspace/ingest] market snapshots upsert inserted=${inserted} updated=${updated}`,
    );
    return { inserted, updated };
  },
});

export const replaceLiveIntelItems = internalMutation({
  args: {
    rows: v.array(LiveIntelItemInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("liveIntelItems").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const row of args.rows) {
      await ctx.db.insert("liveIntelItems", {
        panel: row.panel,
        title: row.title,
        value: row.value,
        changePct: row.changePct,
        timeframe: row.timeframe,
        sentiment: row.sentiment,
        updatedAt: now,
      });
    }

    console.info(
      `[workspace/ingest] live intel replaced deleted=${existing.length} inserted=${args.rows.length}`,
    );
    return { deleted: existing.length, inserted: args.rows.length };
  },
});

export const replaceIndicatorAlerts = internalMutation({
  args: {
    rows: v.array(IndicatorAlertInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("indicatorAlerts").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const row of args.rows) {
      await ctx.db.insert("indicatorAlerts", {
        panel: row.panel,
        title: row.title,
        side: row.side,
        timeframe: row.timeframe,
        price: row.price,
        eventDate: row.eventDate,
        ...(typeof row.live === "boolean" ? { live: row.live } : {}),
        updatedAt: now,
      });
    }

    console.info(
      `[workspace/ingest] indicator alerts replaced deleted=${existing.length} inserted=${args.rows.length}`,
    );
    return { deleted: existing.length, inserted: args.rows.length };
  },
});

export const replaceNewsArticles = internalMutation({
  args: {
    rows: v.array(NewsArticleInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("newsArticles").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const row of args.rows) {
      await ctx.db.insert("newsArticles", {
        source: row.source,
        title: row.title,
        url: row.url,
        category: row.category,
        publishedAt: row.publishedAt,
        ...(typeof row.featured === "boolean" ? { featured: row.featured } : {}),
        updatedAt: now,
      });
    }

    console.info(
      `[workspace/ingest] news articles replaced deleted=${existing.length} inserted=${args.rows.length}`,
    );
    return { deleted: existing.length, inserted: args.rows.length };
  },
});

export const seedStrategiesIfMissing = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("strategyEntries").take(1);
    if (existing.length > 0) {
      return { inserted: 0, skipped: true as const };
    }

    const now = Date.now();
    const defaults: Array<{
      analyst: string;
      strategy: string;
      description: string;
      tags: string[];
      sections: Array<{ title: string; body: string }>;
    }> = [
      {
        analyst: "Sveezy",
        strategy: "Breakout Framework",
        description:
          "Volume-based breakout strategy focused on clean breaks through resistance with clear expansion space.",
        tags: ["Breakout", "Momentum", "5m", "1h"],
        sections: [
          {
            title: "Identifying Resistance",
            body: "Start with repeated resistance tests on the 1h chart. Ignore weak levels with no rejection history.",
          },
          {
            title: "Execution Model",
            body: "On approach, drop to 5m and wait for structure break plus volume confirmation before entry.",
          },
          {
            title: "Trade Validation",
            body: "Pass on crowded overhead volume. Only execute when expansion path is clear.",
          },
        ],
      },
      {
        analyst: "Soul",
        strategy: "Level-to-Level Scalping",
        description:
          "Momentum-based scalping using volume profile and confirmation entries for precise level-to-level execution.",
        tags: ["Scalping", "Momentum", "1m", "3m", "15m"],
        sections: [
          {
            title: "Session Bias",
            body: "Set directional bias from higher timeframe structure before selecting lower timeframe entries.",
          },
          {
            title: "Entry Trigger",
            body: "Use reaction zones with reclaim plus displacement candle as the trigger.",
          },
          {
            title: "Risk Control",
            body: "Cut quickly on failed reclaims and re-enter only after structure resets.",
          },
        ],
      },
      {
        analyst: "Badillusion",
        strategy: "Multi-Timeframe Structure Trading",
        description:
          "Comprehensive framework combining macro trend alignment with lower timeframe execution triggers.",
        tags: ["Swing", "Structure", "4h", "1d"],
        sections: [
          {
            title: "Macro Context",
            body: "Align 4h and 1d structure before entering. Avoid counter-trend setups unless invalidation is tight.",
          },
          {
            title: "Trigger Zone",
            body: "Wait for pullback into value zone and watch for momentum re-acceleration.",
          },
          {
            title: "Management",
            body: "Scale partially at first target and trail remainder beneath reclaimed structure.",
          },
        ],
      },
    ];

    for (const entry of defaults) {
      await ctx.db.insert("strategyEntries", {
        analyst: entry.analyst,
        strategy: entry.strategy,
        description: entry.description,
        tags: entry.tags,
        sections: entry.sections,
        active: true,
        updatedAt: now,
      });
    }

    console.info(`[workspace/ingest] seeded default strategies inserted=${defaults.length}`);
    return { inserted: defaults.length, skipped: false as const };
  },
});

export const refreshExternalWorkspaceFeeds = internalAction({
  args: {},
  handler: async (ctx) => {
    const coinGeckoUrl =
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=80&page=1&sparkline=true&price_change_percentage=1h,24h";
    const cryptoCompareNewsUrl = "https://min-api.cryptocompare.com/data/v2/news/?lang=EN";

    const marketData = await fetchJson<CoinGeckoMarketRow[]>(coinGeckoUrl);
    const marketRows = marketData
      .map((row) => {
        const symbol = (row.symbol ?? "").trim().toUpperCase();
        const name = (row.name ?? "").trim();
        if (!symbol || !name) return null;

        const sparkline = (row.sparkline_in_7d?.price ?? [])
          .map((value) => toFiniteNumber(value))
          .filter((value) => Number.isFinite(value))
          .slice(-72);

        return {
          symbol,
          name,
          price: toFiniteNumber(row.current_price),
          change1h: toFiniteNumber(row.price_change_percentage_1h_in_currency),
          change24h: toFiniteNumber(row.price_change_percentage_24h),
          marketCap: toFiniteNumber(row.market_cap),
          volume24h: toFiniteNumber(row.total_volume),
          high24h: toFiniteNumber(row.high_24h),
          low24h: toFiniteNumber(row.low_24h),
          ...(sparkline.length > 0 ? { sparkline7d: sparkline } : {}),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .slice(0, DEFAULT_MARKET_LIMIT);

    const sortedByChange = [...marketRows].sort((a, b) => b.change24h - a.change24h);
    const sortedByVolume = [...marketRows].sort((a, b) => b.volume24h - a.volume24h);

    const liveIntelRows = [
      ...sortedByChange.slice(0, 6).map((row) => ({
        panel: "market-movers",
        title: `${row.symbol} Gainer`,
        value: row.price,
        changePct: row.change24h,
        timeframe: "1d" as const,
        sentiment: "bullish" as const,
      })),
      ...sortedByChange.slice(-6).reverse().map((row) => ({
        panel: "market-movers",
        title: `${row.symbol} Loser`,
        value: row.price,
        changePct: row.change24h,
        timeframe: "1d" as const,
        sentiment: "bearish" as const,
      })),
      ...sortedByVolume.slice(0, 8).map((row) => ({
        panel: "top-volume",
        title: `${row.symbol} Volume`,
        value: row.volume24h,
        changePct: row.change24h,
        timeframe: "1h" as const,
        sentiment: row.change24h >= 0 ? ("bullish" as const) : ("bearish" as const),
      })),
    ];

    const now = Date.now();
    const indicatorRows = [
      ...sortedByChange.slice(0, 10).map((row) => ({
        panel: "oracle" as const,
        title: `${row.symbol} Bullish Momentum`,
        side: "bull" as const,
        timeframe: "1h",
        price: toUsdPrice(row.price),
        eventDate: toIsoDate(now),
        live: true,
      })),
      ...sortedByChange.slice(-10).reverse().map((row) => ({
        panel: "watchlist" as const,
        title: `${row.symbol} Bearish Momentum`,
        side: "bear" as const,
        timeframe: "1h",
        price: toUsdPrice(row.price),
        eventDate: toIsoDate(now),
        live: true,
      })),
    ];

    const newsPayload = await fetchJson<CryptoCompareNewsResponse>(cryptoCompareNewsUrl);
    const newsRows = (newsPayload.Data ?? [])
      .map((item, index) => {
        const title = (item.title ?? "").trim();
        const url = (item.url ?? "").trim();
        if (!title || !url) return null;
        const source = (item.source_info?.name ?? item.source ?? "Unknown").trim() || "Unknown";
        const categoryRaw = (item.categories ?? "MARKET").split("|")[0]?.trim();
        const category = categoryRaw && categoryRaw.length > 0 ? categoryRaw : "MARKET";
        const publishedAtSeconds = toFiniteNumber(item.published_on);
        const publishedAtMs = publishedAtSeconds > 0 ? publishedAtSeconds * 1000 : Date.now();
        return {
          source,
          title,
          url,
          category,
          publishedAt: publishedAtMs,
          featured: index < 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, DEFAULT_NEWS_LIMIT);

    const marketResult = await ctx.runMutation(internal.workspace.upsertMarketSnapshots, {
      rows: marketRows,
    });
    const liveIntelResult = await ctx.runMutation(internal.workspace.replaceLiveIntelItems, {
      rows: liveIntelRows,
    });
    const indicatorResult = await ctx.runMutation(internal.workspace.replaceIndicatorAlerts, {
      rows: indicatorRows,
    });
    const newsResult = await ctx.runMutation(internal.workspace.replaceNewsArticles, {
      rows: newsRows,
    });
    const strategySeedResult = await ctx.runMutation(internal.workspace.seedStrategiesIfMissing, {});

    console.info(
      `[workspace/ingest] refresh complete markets_inserted=${marketResult.inserted} markets_updated=${marketResult.updated} live_intel_inserted=${liveIntelResult.inserted} indicator_inserted=${indicatorResult.inserted} news_inserted=${newsResult.inserted} strategy_seed_inserted=${strategySeedResult.inserted}`,
    );

    return {
      ok: true as const,
      markets: marketResult,
      liveIntel: liveIntelResult,
      indicators: indicatorResult,
      news: newsResult,
      strategySeed: strategySeedResult,
    };
  },
});
