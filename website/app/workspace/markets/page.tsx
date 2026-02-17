import { ChartCard } from "@/components/workspace/chart-card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { buildMarketKpis, normalizeMarketRows } from "../lib/marketAdapter";
import { MarketsKpiRow } from "./components/markets-kpi-row";
import { MarketsTable } from "./components/markets-table";

const mockMarketData = normalizeMarketRows([
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    price: 67818,
    change1h: -0.04,
    change24h: -1.15,
    marketCap: 1_360_000_000_000,
    sparkline7d: [67120, 67310, 67800, 67550, 67610, 67730, 67818],
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    price: 1968.27,
    change1h: 0.17,
    change24h: -0.06,
    marketCap: 237_740_000_000,
    sparkline7d: [1910, 1925, 1940, 1936, 1955, 1961, 1968.27],
  },
  {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    price: 84.98,
    change1h: -0.04,
    change24h: -0.3,
    marketCap: 48_250_000_000,
    sparkline7d: [81.1, 82.5, 83.2, 84.1, 83.8, 84.7, 84.98],
  },
  {
    id: "xrp",
    symbol: "XRP",
    name: "XRP",
    price: 1.46,
    change1h: 0.07,
    change24h: -1.77,
    marketCap: 88_680_000_000,
    sparkline7d: [1.37, 1.41, 1.39, 1.42, 1.45, 1.44, 1.46],
  },
  {
    id: "doge",
    symbol: "DOGE",
    name: "Dogecoin",
    price: 0.0987,
    change1h: 0.01,
    change24h: -2.81,
    marketCap: 16_650_000_000,
    sparkline7d: [0.088, 0.091, 0.094, 0.092, 0.095, 0.097, 0.0987],
  },
]);

export default function MarketsPage() {
  const kpis = buildMarketKpis(mockMarketData);

  return (
    <>
      <WorkspaceSectionHeader
        title="Markets"
        description="Track market structure with a compact universe snapshot and quick direction context."
      />

      <MarketsKpiRow
        totalMarketCap={kpis.totalMarketCap}
        avgChange24h={kpis.avgChange24h}
        gainers={kpis.gainers}
        losers={kpis.losers}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="BTC 7D" values={mockMarketData.find((row) => row.symbol === "BTC")?.sparkline7d ?? []} />
        <ChartCard title="ETH 7D" values={mockMarketData.find((row) => row.symbol === "ETH")?.sparkline7d ?? []} />
        <ChartCard title="SOL 7D" values={mockMarketData.find((row) => row.symbol === "SOL")?.sparkline7d ?? []} />
      </div>

      <MarketsTable rows={mockMarketData} />
    </>
  );
}

