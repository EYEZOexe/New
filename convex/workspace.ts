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

type StrategyLibrarySection = {
  title: string;
  body: string;
};

type StrategyLibraryEntry = {
  analyst: string;
  strategy: string;
  description: string;
  tags: string[];
  sections: StrategyLibrarySection[];
};

const DEFAULT_STRATEGY_LIBRARY: StrategyLibraryEntry[] = [
  {
    analyst: "Prestige",
    strategy: "Breakout Framework",
    description:
      "Volume-based breakout strategy focused on clean breaks through resistance with clear expansion space.",
    tags: ["Breakout", "Momentum", "5m", "1h"],
    sections: [
      {
        title: "Identifying Resistance",
        body: "Use 1h resistance levels that have multiple respected touches. Avoid random lines with no clear reaction history.",
      },
      {
        title: "Volume Gap Analysis",
        body: "Check for low-volume space above resistance. If overhead is crowded with volume, skip the setup and wait.",
      },
      {
        title: "Execution Model",
        body: "As price approaches resistance, drop to 5m and mark the final bearish block below the level for execution reference.",
      },
      {
        title: "Trade Validation",
        body: "Only execute if the break is clean and has room to run before the next high-volume zone.",
      },
      {
        title: "Core Principle",
        body: "Take trades only when the path forward is clear. If the market offers no space, do not force execution.",
      },
    ],
  },
  {
    analyst: "Soul",
    strategy: "Level-to-Level Scalping",
    description:
      "Momentum-based scalping using volume profile and confirmation entry models for precise level-to-level execution.",
    tags: ["Scalping", "Momentum", "1m", "3m", "15m"],
    sections: [
      {
        title: "Trading Philosophy",
        body: "Scalping is focused on momentum moves from one clear level into the next, not passive limit order catching.",
      },
      {
        title: "Strategy 1: Volume Profile",
        body: "Use previous-session profile levels and align them with local confluence like FVG, order blocks, and structure.",
      },
      {
        title: "Strategy 2: Confirmation Entry Model",
        body: "Primary executions are on 1m and 3m confirmations after reaction at mapped levels.",
      },
      {
        title: "Additional Tools",
        body: "Supplement with harmonic context, stochastic RSI, and basic supply-demand zones for cleaner execution bias.",
      },
    ],
  },
  {
    analyst: "Badillusion",
    strategy: "Multi-Timeframe Structure Trading",
    description:
      "Comprehensive framework combining macro analysis, higher timeframe structure, and pattern-based entries with defined TP ladders.",
    tags: ["Swing", "Intraday", "1h", "4h", "1d"],
    sections: [
      {
        title: "Daily Macro Checks",
        body: "Start with USDT.D, stablecoin dominance, BTC, Total, Total3, and BTC.D to establish directional bias.",
      },
      {
        title: "Structure Analysis",
        body: "Map HTF structure using key ranges, fib levels, and bullish or bearish MSS-BOS context before looking for entries.",
      },
      {
        title: "Intraday Entry Model",
        body: "Use trendline context, S-R flips, and clean pattern continuation only when aligned with HTF bias.",
      },
      {
        title: "Swing Entry Model",
        body: "Favor strong coins for HTF swings and wait for confirmed flips before committing directional size.",
      },
      {
        title: "Take Profit Strategy",
        body: "Use staged take-profits with runner logic and tighten risk after TP1 by moving stops to entry.",
      },
    ],
  },
  {
    analyst: "Prestige",
    strategy: "Standard Entry Reversal Model",
    description:
      "Pattern-based reversal framework that waits for confirmation around POIs instead of blind limit entries.",
    tags: ["Reversal", "Confirmation", "15m", "1m", "POI"],
    sections: [
      {
        title: "Model Overview",
        body: "The model prioritizes confirmation at POIs to improve risk-reward and reduce losses from blind level entries.",
      },
      {
        title: "Entry Process",
        body: "Wait for approach into POI, structure formation, sweep, shift confirmation, then define the dealing range before entry.",
      },
      {
        title: "Execution",
        body: "Execute on retrace into discount or premium of the dealing range at OTE, OB, or FVG zones.",
      },
      {
        title: "Targets and POIs",
        body: "Target recent or higher-timeframe swing points and prioritize major POIs like S-R, supply-demand, and key opens.",
      },
      {
        title: "Why Confirmation Matters",
        body: "Confirmation reduces failed POI reactions and improves consistency versus immediate unconfirmed entries.",
      },
    ],
  },
  {
    analyst: "Scient",
    strategy: "HTF Macro-Aligned Framework",
    description:
      "High-timeframe, patience-focused approach built on institutional levels and macro alignment for asymmetric risk.",
    tags: ["Swing", "Position", "1d", "3d", "1w", "Macro"],
    sections: [
      {
        title: "Trading Philosophy",
        body: "Trade fewer, higher quality setups where risk is clearly defined and reward is meaningful.",
      },
      {
        title: "HTF Levels (Foundation)",
        body: "Core decision points are built from high-timeframe support and resistance on 1D, 3D, and 1W charts.",
      },
      {
        title: "Macro Bias",
        body: "Build directional bias from USDT.D, BTC.D, TOTAL, and TOTAL2 before selecting assets and setups.",
      },
      {
        title: "Trend and Market Environment",
        body: "React to higher-high and higher-low or lower-high and lower-low structure. Avoid predicting reversals.",
      },
      {
        title: "Range Identification",
        body: "Use AMD, PO3, and premium-discount concepts to avoid mid-range entries and execute near extremes.",
      },
    ],
  },
  {
    analyst: "Grasady",
    strategy: "Harmonic Trading",
    description:
      "Macro harmonic patterns on higher timeframes combined with lower timeframe confirmation for precise entries.",
    tags: ["Harmonic", "Multi-Timeframe", "1h", "4h", "1d", "1w"],
    sections: [
      {
        title: "Trading Philosophy",
        body: "The process is simple: map higher-timeframe harmonics first, then execute only on confirmed reactions.",
      },
      {
        title: "Mapping Macro Harmonics",
        body: "Start from daily and weekly structure to map significant harmonic levels that can drive directional bias.",
      },
      {
        title: "Forming Bias",
        body: "Use mapped harmonic zones to define directional scenarios and no-trade areas.",
      },
      {
        title: "Lower Timeframe Patterns",
        body: "When price reaches mapped zones, drop to 4h or 1h and wait for lower-timeframe pattern confirmation.",
      },
      {
        title: "Execution and Risk Management",
        body: "Execute only after reaction confirmation; manage SL from structure and set TP around major fib reaction zones.",
      },
    ],
  },
];

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

function normalizeStrategyKey(value: string): string {
  return value.trim().toLowerCase();
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function areStrategySectionsEqual(
  left: StrategyLibrarySection[],
  right: StrategyLibrarySection[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every(
    (section, index) =>
      section.title === right[index]?.title && section.body === right[index]?.body,
  );
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
    const now = Date.now();
    const existing = await ctx.db.query("strategyEntries").collect();
    const existingByStrategy = new Map<string, (typeof existing)[number]>();
    for (const row of existing) {
      const key = normalizeStrategyKey(row.strategy);
      if (!existingByStrategy.has(key)) {
        existingByStrategy.set(key, row);
      }
    }

    let inserted = 0;
    let updated = 0;

    for (const entry of DEFAULT_STRATEGY_LIBRARY) {
      const key = normalizeStrategyKey(entry.strategy);
      const current = existingByStrategy.get(key);

      if (!current) {
        await ctx.db.insert("strategyEntries", {
          analyst: entry.analyst,
          strategy: entry.strategy,
          description: entry.description,
          tags: entry.tags,
          sections: entry.sections,
          active: true,
          updatedAt: now,
        });
        inserted += 1;
        continue;
      }

      const currentTags = current.tags ?? [];
      const currentSections = current.sections ?? [];
      const needsUpdate =
        current.analyst !== entry.analyst ||
        current.description !== entry.description ||
        current.active !== true ||
        !areStringArraysEqual(currentTags, entry.tags) ||
        !areStrategySectionsEqual(currentSections, entry.sections);

      if (!needsUpdate) {
        continue;
      }

      await ctx.db.patch(current._id, {
        analyst: entry.analyst,
        description: entry.description,
        tags: entry.tags,
        sections: entry.sections,
        active: true,
        updatedAt: now,
      });
      updated += 1;
    }

    console.info(
      `[workspace/ingest] synchronized default strategies inserted=${inserted} updated=${updated} defaults=${DEFAULT_STRATEGY_LIBRARY.length}`,
    );
    return {
      inserted,
      updated,
      skipped: inserted === 0 && updated === 0 ? (true as const) : (false as const),
    };
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
      `[workspace/ingest] refresh complete markets_inserted=${marketResult.inserted} markets_updated=${marketResult.updated} live_intel_inserted=${liveIntelResult.inserted} indicator_inserted=${indicatorResult.inserted} news_inserted=${newsResult.inserted} strategy_seed_inserted=${strategySeedResult.inserted} strategy_seed_updated=${strategySeedResult.updated}`,
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
