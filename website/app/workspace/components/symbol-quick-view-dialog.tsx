"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDialog } from "@/components/workspace/detail-dialog";

type SymbolQuickViewDialogProps = {
  trigger: ReactNode;
  symbol: string;
  contract: string;
  price: number;
  changePct: number;
  volume24h: string;
  fundingRate: string;
  high24h: string;
  low24h: string;
};

export function SymbolQuickViewDialog(props: SymbolQuickViewDialogProps) {
  return (
    <DetailDialog
      trigger={props.trigger}
      title={props.symbol}
      description={props.contract}
      contentClassName="max-w-xl border-border/70 bg-card/95"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="site-kicker">Current Price</p>
            <p className="mt-1 text-4xl font-semibold">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 2,
              }).format(props.price)}
            </p>
          </div>
          <Badge
            variant="outline"
            className={props.changePct >= 0 ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}
          >
            {props.changePct >= 0 ? "+" : ""}
            {props.changePct.toFixed(2)}%
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="site-soft">
            <p className="site-kicker">24h Volume</p>
            <p className="mt-1 text-xl font-semibold">{props.volume24h}</p>
          </div>
          <div className="site-soft">
            <p className="site-kicker">Funding Rate</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{props.fundingRate}</p>
          </div>
          <div className="site-soft">
            <p className="site-kicker">24h High</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{props.high24h}</p>
          </div>
          <div className="site-soft">
            <p className="site-kicker">24h Low</p>
            <p className="mt-1 text-xl font-semibold text-red-300">{props.low24h}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild>
            <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
              View Chart
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="https://blfin.com/" target="_blank" rel="noreferrer">
              Trade on Blfin
            </a>
          </Button>
        </div>
      </div>
    </DetailDialog>
  );
}

