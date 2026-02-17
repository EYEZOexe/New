export type WorkspaceDirection = "long" | "short";

export type MarketInstrument = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change1h: number;
  change24h: number;
  marketCap: number;
  volume24h?: number;
  sparkline7d?: number[];
};

export type LiveIntelCard = {
  id: string;
  panel: string;
  title: string;
  value: number;
  changePct: number;
  timeframe: "5m" | "15m" | "1h" | "4h" | "1d";
  sentiment: "bullish" | "bearish" | "neutral";
};

export type JournalTrade = {
  id: string;
  symbol: string;
  direction: WorkspaceDirection;
  entry: number;
  exit: number | null;
  pnl: number;
  status: "open" | "closed";
  openedAt: number;
  closedAt?: number | null;
};

export type NewsArticle = {
  id: string;
  source: string;
  title: string;
  url: string;
  category: string;
  publishedAt: number;
  featured?: boolean;
};

