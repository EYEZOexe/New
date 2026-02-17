import { Card, CardContent } from "@/components/ui/card";

type JournalKpisProps = {
  netPnl: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  bestTrade: number;
  maxDrawdown: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function JournalKpis(props: JournalKpisProps) {
  const cells = [
    { label: "Net P&L", value: formatMoney(props.netPnl) },
    { label: "Win Rate", value: `${(props.winRate * 100).toFixed(1)}%` },
    { label: "Profit Factor", value: props.profitFactor.toFixed(2) },
    { label: "Expectancy", value: formatMoney(props.expectancy) },
    { label: "Best Trade", value: formatMoney(props.bestTrade) },
    { label: "Max Drawdown", value: formatMoney(props.maxDrawdown) },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cells.map((cell) => (
        <Card key={cell.label} className="site-soft">
          <CardContent className="space-y-1 px-0">
            <p className="site-kicker">{cell.label}</p>
            <p className="text-2xl font-semibold">{cell.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

