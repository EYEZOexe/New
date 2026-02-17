import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { JournalKpis } from "./components/journal-kpis";
import { LogTradeDialog } from "./components/log-trade-dialog";
import { PnlCalendar } from "./components/pnl-calendar";
import { TradeLogTable } from "./components/trade-log-table";

const tradeRows = [
  {
    id: "t-1",
    symbol: "POWER/USDT",
    direction: "short" as const,
    entry: 0.2932,
    exit: 0.3074,
    pnl: -1.0,
    status: "closed" as const,
    date: "2026-02-17",
  },
  {
    id: "t-2",
    symbol: "BTC/USDT",
    direction: "long" as const,
    entry: 67120,
    exit: null,
    pnl: 0.0,
    status: "open" as const,
    date: "2026-02-16",
  },
];

export default function JournalPage() {
  return (
    <>
      <WorkspaceSectionHeader
        title="Trading Journal"
        description="Track trade quality, execution consistency, and outcome distribution."
        actions={<LogTradeDialog />}
      />

      <JournalKpis netPnl={-1} winRate={0} profitFactor={0} expectancy={0} bestTrade={0} maxDrawdown={-0} />

      <div className="grid gap-4 xl:grid-cols-2">
        <PnlCalendar />
        <Card className="site-panel">
          <CardHeader className="px-0 pb-2">
            <CardTitle className="text-base">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-56 items-center justify-center px-0 text-sm text-muted-foreground">
            Need 2+ closed trades
          </CardContent>
        </Card>
      </div>

      <TradeLogTable rows={tradeRows} />
    </>
  );
}

