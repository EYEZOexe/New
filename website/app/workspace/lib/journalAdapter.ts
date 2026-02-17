import type { JournalTrade } from "./types";

type JournalTradeInput = Partial<JournalTrade> | null | undefined;

function sanitizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return 0;
}

export function normalizeJournalTrades(input: JournalTradeInput[] | null | undefined): JournalTrade[] {
  if (!input?.length) return [];

  const trades = input
    .map((item, index): JournalTrade | null => {
      const symbol = item?.symbol?.trim().toUpperCase();
      if (!symbol) return null;

      return {
        id: item?.id?.trim() || `trade-${index}`,
        symbol,
        direction: item?.direction === "short" ? "short" : "long",
        entry: sanitizeNumber(item?.entry),
        exit: typeof item?.exit === "number" ? item.exit : null,
        pnl: sanitizeNumber(item?.pnl),
        status: item?.status === "closed" ? "closed" : "open",
        openedAt: sanitizeTimestamp(item?.openedAt),
        closedAt: typeof item?.closedAt === "number" ? item.closedAt : null,
      };
    })
    .filter((trade): trade is JournalTrade => trade !== null);

  trades.sort((left, right) => {
    if (left.openedAt !== right.openedAt) {
      return right.openedAt - left.openedAt;
    }
    return left.symbol.localeCompare(right.symbol);
  });

  return trades;
}

export function summarizeJournalTrades(trades: JournalTrade[]): {
  total: number;
  openCount: number;
  closedCount: number;
  netPnl: number;
  winRate: number;
} {
  if (trades.length === 0) {
    return {
      total: 0,
      openCount: 0,
      closedCount: 0,
      netPnl: 0,
      winRate: 0,
    };
  }

  const openCount = trades.filter((trade) => trade.status === "open").length;
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const wins = closedTrades.filter((trade) => trade.pnl > 0).length;
  const winRate = closedTrades.length > 0 ? wins / closedTrades.length : 0;

  return {
    total: trades.length,
    openCount,
    closedCount: closedTrades.length,
    netPnl,
    winRate,
  };
}

