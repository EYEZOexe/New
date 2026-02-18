"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { normalizeJournalTrades, summarizeJournalTrades } from "../lib/journalAdapter";
import type { TradeFormValues } from "./lib/tradeFormSchema";
import { JournalKpis } from "./components/journal-kpis";
import { LogTradeDialog } from "./components/log-trade-dialog";
import { PnlCalendar } from "./components/pnl-calendar";
import { TradeLogTable } from "./components/trade-log-table";

const listJournalTradesRef = makeFunctionReference<
  "query",
  { limit?: number },
  Array<{
    _id: string;
    coin: string;
    direction: "long" | "short";
    entryPrice: number;
    exitPrice?: number;
    stopLoss: number;
    riskUsd: number;
    takeProfits?: number[];
    pnlUsd?: number;
    leverage: string;
    setup: string;
    executionGrade: "A" | "B" | "C" | "D";
    status: "open" | "closed";
    entryDate: string;
    exitDate?: string;
    notes?: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
  }>
>("workspace:listJournalTrades");

const createJournalTradeRef = makeFunctionReference<
  "mutation",
  {
    coin: string;
    direction: "long" | "short";
    entryPrice: number;
    exitPrice?: number;
    stopLoss: number;
    riskUsd: number;
    takeProfits?: number[];
    pnlUsd?: number;
    leverage: string;
    setup: string;
    executionGrade: "A" | "B" | "C" | "D";
    status: "open" | "closed";
    entryDate: string;
    exitDate?: string;
    notes?: string;
    tags?: string[];
  },
  { ok: true; tradeId: string }
>("workspace:createJournalTrade");

export default function JournalPage() {
  const rawTrades = useQuery(listJournalTradesRef, { limit: 200 });
  const createJournalTrade = useMutation(createJournalTradeRef);

  const normalizedTrades = useMemo(
    () =>
      normalizeJournalTrades(
        (rawTrades ?? []).map((row) => ({
          id: row._id,
          symbol: row.coin,
          direction: row.direction,
          entry: row.entryPrice,
          exit: row.exitPrice ?? null,
          pnl: row.pnlUsd ?? 0,
          status: row.status,
          openedAt: row.createdAt,
          closedAt: row.exitDate ? Date.parse(row.exitDate) : null,
        })),
      ),
    [rawTrades],
  );
  const summary = summarizeJournalTrades(normalizedTrades);

  async function onCreateTrade(trade: TradeFormValues) {
    await createJournalTrade({
      coin: trade.coin,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      ...(typeof trade.exitPrice === "number" ? { exitPrice: trade.exitPrice } : {}),
      stopLoss: trade.stopLoss,
      riskUsd: trade.riskUsd,
      ...(trade.takeProfits.length ? { takeProfits: trade.takeProfits } : {}),
      ...(typeof trade.pnlUsd === "number" ? { pnlUsd: trade.pnlUsd } : {}),
      leverage: trade.leverage,
      setup: trade.setup,
      executionGrade: trade.executionGrade,
      status: trade.status,
      entryDate: trade.entryDate,
      ...(trade.exitDate ? { exitDate: trade.exitDate } : {}),
      ...(trade.notes ? { notes: trade.notes } : {}),
      ...(trade.tags.length ? { tags: trade.tags } : {}),
    });
  }

  const tradeRows = normalizedTrades.map((trade) => ({
    id: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    entry: trade.entry,
    exit: trade.exit,
    pnl: trade.pnl,
    status: trade.status,
    date: new Date(trade.openedAt).toISOString().slice(0, 10),
  }));

  return (
    <>
      <WorkspaceSectionHeader
        title="Trading Journal"
        description="Track trade quality, execution consistency, and outcome distribution."
        actions={<LogTradeDialog onCreate={onCreateTrade} />}
      />

      <JournalKpis
        netPnl={summary.netPnl}
        winRate={summary.winRate}
        profitFactor={0}
        expectancy={0}
        bestTrade={Math.max(0, ...normalizedTrades.map((trade) => trade.pnl))}
        maxDrawdown={Math.min(0, ...normalizedTrades.map((trade) => trade.pnl))}
      />

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

      {rawTrades === undefined ? (
        <Card className="site-panel">
          <CardContent className="px-0 py-6 text-sm text-muted-foreground">
            Loading journal trades...
          </CardContent>
        </Card>
      ) : (
        <TradeLogTable rows={tradeRows} />
      )}
    </>
  );
}
