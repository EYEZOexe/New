"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TradeDetailDialog } from "@/app/workspace/components/trade-detail-dialog";
import { cn } from "@/lib/utils";

type TradeLogRow = {
  id: string;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  exit: number | null;
  stopLoss: number | null;
  pnl: number;
  status: "open" | "closed";
  date: string;
};

type TradeLogTableProps = {
  rows: TradeLogRow[];
};

function formatPrice(value: number | null): string {
  if (value === null) return "--";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

export function TradeLogTable(props: TradeLogTableProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");

  const rows = useMemo(() => {
    if (statusFilter === "all") return props.rows;
    return props.rows.filter((row) => row.status === statusFilter);
  }, [props.rows, statusFilter]);

  useEffect(() => {
    console.info(
      `[workspace/journal] filter=${statusFilter} total=${props.rows.length} visible=${rows.length}`,
    );
  }, [props.rows.length, rows.length, statusFilter]);

  return (
    <Card className="site-panel site-card-hover">
      <CardHeader className="flex flex-row items-center justify-between px-0 pb-3">
        <CardTitle className="text-base">Trade Log</CardTitle>
        <div className="flex gap-2">
          {(["all", "open", "closed"] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              className="rounded-full capitalize"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/35">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border/70 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Entry</th>
                <th className="px-4 py-3">Exit</th>
                <th className="px-4 py-3">P&L</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                    No trades recorded for the selected status.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-cyan-500/6"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.symbol}</p>
                    <p className="text-xs text-muted-foreground">{row.date}</p>
                  </td>
                  <td className="px-4 py-3">{formatPrice(row.entry)}</td>
                  <td className="px-4 py-3">{formatPrice(row.exit)}</td>
                  <td className={cn("px-4 py-3 font-semibold", row.pnl >= 0 ? "text-emerald-300" : "text-red-300")}>
                    {row.pnl >= 0 ? "+" : ""}
                    {row.pnl.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TradeDetailDialog
                      trigger={
                        <Button size="sm" variant="outline" className="rounded-full">
                          Open
                        </Button>
                      }
                      symbol={row.symbol}
                      direction={row.direction}
                      date={row.date}
                      entry={row.entry}
                      exit={row.exit}
                      stopLoss={row.stopLoss}
                      pnl={row.pnl}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
