"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DetailDialog } from "@/components/workspace/detail-dialog";

type TradeDetailDialogProps = {
  trigger: ReactNode;
  symbol: string;
  direction: "long" | "short";
  date: string;
  entry: number;
  exit: number | null;
  stopLoss?: number | null;
  pnl: number;
};

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number") return "--";
  return value.toFixed(4);
}

export function TradeDetailDialog(props: TradeDetailDialogProps) {
  return (
    <DetailDialog
      trigger={props.trigger}
      title={props.symbol}
      description={`${props.direction.toUpperCase()} • ${props.date}`}
      contentClassName="max-w-3xl border-border/70 bg-card/95"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="site-soft">
          <p className="site-kicker">Entry</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">{formatNumber(props.entry)}</p>
        </div>
        <div className="site-soft">
          <p className="site-kicker">Exit</p>
          <p className="mt-1 text-xl font-semibold text-red-300">{formatNumber(props.exit)}</p>
        </div>
        <div className="site-soft">
          <p className="site-kicker">Stop Loss</p>
          <p className="mt-1 text-xl font-semibold text-red-300">{formatNumber(props.stopLoss)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <Badge variant="outline" className="capitalize">
          {props.direction}
        </Badge>
        <p className={props.pnl >= 0 ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>
          {props.pnl >= 0 ? "+" : ""}
          {props.pnl.toFixed(2)}R
        </p>
      </div>
    </DetailDialog>
  );
}

