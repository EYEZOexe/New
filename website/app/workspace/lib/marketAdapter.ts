import type { MarketInstrument } from "./types";

type MarketInput = Partial<MarketInstrument> | null | undefined;

function sanitizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeMarketRows(input: MarketInput[] | null | undefined): MarketInstrument[] {
  if (!input?.length) return [];

  const rows = input
    .map((row, index): MarketInstrument | null => {
      const symbol = row?.symbol?.trim().toUpperCase();
      if (!symbol) return null;

      return {
        id: row?.id?.trim() || `${symbol}-${index}`,
        symbol,
        name: row?.name?.trim() || symbol,
        price: sanitizeNumber(row?.price),
        change1h: sanitizeNumber(row?.change1h),
        change24h: sanitizeNumber(row?.change24h),
        marketCap: sanitizeNumber(row?.marketCap),
        volume24h: sanitizeNumber(row?.volume24h),
        sparkline7d: Array.isArray(row?.sparkline7d)
          ? row?.sparkline7d.filter((point) => typeof point === "number" && Number.isFinite(point))
          : [],
      };
    })
    .filter((row): row is MarketInstrument => row !== null);

  rows.sort((left, right) => {
    if (left.marketCap !== right.marketCap) {
      return right.marketCap - left.marketCap;
    }
    return left.symbol.localeCompare(right.symbol);
  });

  return rows;
}

export function buildMarketKpis(rows: MarketInstrument[]): {
  totalMarketCap: number;
  avgChange24h: number;
  gainers: number;
  losers: number;
} {
  if (rows.length === 0) {
    return {
      totalMarketCap: 0,
      avgChange24h: 0,
      gainers: 0,
      losers: 0,
    };
  }

  const totalMarketCap = rows.reduce((sum, row) => sum + row.marketCap, 0);
  const avgChange24h = rows.reduce((sum, row) => sum + row.change24h, 0) / rows.length;
  const gainers = rows.filter((row) => row.change24h > 0).length;
  const losers = rows.filter((row) => row.change24h < 0).length;

  return {
    totalMarketCap,
    avgChange24h,
    gainers,
    losers,
  };
}

