import type { JournalTrade } from "./types";

export type EquityPoint = {
  tradeId: string;
  label: string;
  pnl: number;
  equity: number;
};

export type DailyPnlPoint = {
  date: string;
  pnl: number;
  trades: number;
};

export type JournalAnalytics = {
  profitFactor: number;
  expectancy: number;
  bestTrade: number;
  maxDrawdown: number;
  equityPoints: EquityPoint[];
  dailyPnl: DailyPnlPoint[];
};

function toFixedNumber(value: number, fractionDigits = 2): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(fractionDigits));
}

function toDateLabel(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function buildJournalAnalytics(trades: JournalTrade[]): JournalAnalytics {
  const closedTrades = trades
    .filter((trade) => trade.status === "closed")
    .sort((left, right) => {
      const leftAt = left.closedAt ?? left.openedAt;
      const rightAt = right.closedAt ?? right.openedAt;
      return leftAt - rightAt;
    });

  let grossWins = 0;
  let grossLosses = 0;
  let cumulativeEquity = 0;
  let peakEquity = 0;
  let maxDrawdown = 0;
  let bestTrade = 0;

  const dailyTotals = new Map<string, { pnl: number; trades: number }>();
  const equityPoints: EquityPoint[] = [];

  for (const trade of closedTrades) {
    const pnl = trade.pnl;
    if (pnl > 0) {
      grossWins += pnl;
    } else if (pnl < 0) {
      grossLosses += pnl;
    }

    cumulativeEquity += pnl;
    peakEquity = Math.max(peakEquity, cumulativeEquity);
    maxDrawdown = Math.min(maxDrawdown, cumulativeEquity - peakEquity);
    bestTrade = Math.max(bestTrade, pnl);

    const closedAt = trade.closedAt ?? trade.openedAt;
    const dateKey = toDateLabel(closedAt);
    const existing = dailyTotals.get(dateKey) ?? { pnl: 0, trades: 0 };
    existing.pnl += pnl;
    existing.trades += 1;
    dailyTotals.set(dateKey, existing);

    equityPoints.push({
      tradeId: trade.id,
      label: dateKey,
      pnl: toFixedNumber(pnl),
      equity: toFixedNumber(cumulativeEquity),
    });
  }

  const netClosedPnl = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const profitFactor =
    grossLosses === 0
      ? grossWins > 0
        ? toFixedNumber(grossWins, 4)
        : 0
      : toFixedNumber(grossWins / Math.abs(grossLosses), 4);
  const expectancy =
    closedTrades.length > 0 ? toFixedNumber(netClosedPnl / closedTrades.length, 2) : 0;

  const dailyPnl = Array.from(dailyTotals.entries())
    .map(([date, value]) => ({
      date,
      pnl: toFixedNumber(value.pnl),
      trades: value.trades,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    profitFactor,
    expectancy,
    bestTrade: toFixedNumber(bestTrade),
    maxDrawdown: toFixedNumber(maxDrawdown),
    equityPoints,
    dailyPnl,
  };
}
