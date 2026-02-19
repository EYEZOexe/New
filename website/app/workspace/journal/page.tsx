"use client";

import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { normalizeJournalTrades, summarizeJournalTrades } from "../lib/journalAdapter";
import { buildJournalAnalytics } from "../lib/journalMetrics";
import type { TradeFormValues } from "./lib/tradeFormSchema";
import { EquityCurve } from "./components/equity-curve";
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
          closedAt: row.status === "closed" ? (row.exitDate ? Date.parse(row.exitDate) : row.updatedAt) : null,
        })),
      ),
    [rawTrades],
  );
  const summary = summarizeJournalTrades(normalizedTrades);
  const analytics = useMemo(() => buildJournalAnalytics(normalizedTrades), [normalizedTrades]);
  const stopLossByTradeId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rawTrades ?? []) {
      map.set(row._id, row.stopLoss);
    }
    return map;
  }, [rawTrades]);

  async function onCreateTrade(trade: TradeFormValues) {
    console.info(
      `[workspace/journal-ui] submitting trade coin=${trade.coin.toUpperCase()} status=${trade.status} entry=${trade.entryPrice} exit=${trade.exitPrice ?? "n/a"} pnl=${trade.pnlUsd ?? 0}`,
    );
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
    stopLoss: stopLossByTradeId.get(trade.id) ?? null,
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
        profitFactor={analytics.profitFactor}
        expectancy={analytics.expectancy}
        bestTrade={analytics.bestTrade}
        maxDrawdown={analytics.maxDrawdown}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PnlCalendar points={analytics.dailyPnl} />
        <EquityCurve points={analytics.equityPoints} />
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
