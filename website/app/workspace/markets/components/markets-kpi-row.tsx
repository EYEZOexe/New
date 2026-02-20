import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type MarketsKpiRowProps = {
  totalMarketCap: number;
  avgChange24h: number;
  gainers: number;
  losers: number;
};

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function MarketsKpiRow(props: MarketsKpiRowProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card className="site-soft site-card-hover">
        <CardContent className="space-y-1 px-0">
          <p className="site-kicker">Market Cap</p>
          <p className="text-2xl font-semibold">{formatCompactCurrency(props.totalMarketCap)}</p>
        </CardContent>
      </Card>

      <Card className="site-soft site-card-hover">
        <CardContent className="space-y-1 px-0">
          <p className="site-kicker">Average 24h</p>
          <p className={`flex items-center gap-1.5 text-2xl font-semibold ${props.avgChange24h >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {props.avgChange24h >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
            {props.avgChange24h.toFixed(2)}%
          </p>
        </CardContent>
      </Card>

      <Card className="site-soft site-card-hover">
        <CardContent className="space-y-1 px-0">
          <p className="site-kicker">Gainers</p>
          <p className="text-2xl font-semibold text-emerald-300">{props.gainers}</p>
        </CardContent>
      </Card>

      <Card className="site-soft site-card-hover">
        <CardContent className="space-y-1 px-0">
          <p className="site-kicker">Losers</p>
          <p className="text-2xl font-semibold text-red-300">{props.losers}</p>
          <TrendingUp className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}
