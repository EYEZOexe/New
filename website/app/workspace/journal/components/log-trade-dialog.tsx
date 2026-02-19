"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { tradeFormSchema, type TradeFormValues } from "../lib/tradeFormSchema";

type LogTradeDialogProps = {
  onCreate?: (trade: TradeFormValues) => void;
};

type DraftTrade = {
  coin: string;
  direction: "long" | "short";
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  riskUsd: string;
  setup: string;
  executionGrade: "A" | "B" | "C" | "D";
  status: "open" | "closed";
  entryDate: string;
  exitDate: string;
  notes: string;
  leverage: string;
  tags: string;
  takeProfits: string;
};

const initialDraft: DraftTrade = {
  coin: "",
  direction: "long",
  entryPrice: "",
  exitPrice: "",
  stopLoss: "",
  riskUsd: "",
  setup: "",
  executionGrade: "B",
  status: "open",
  entryDate: "",
  exitDate: "",
  notes: "",
  leverage: "5x",
  tags: "",
  takeProfits: "",
};

function parseNumber(value: string): number {
  return Number(value.trim());
}

function computeClosedTradePnlUsd(input: {
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  riskUsd: number;
}): number {
  if (input.riskUsd <= 0) return 0;

  const riskPerUnit =
    input.direction === "long"
      ? input.entryPrice - input.stopLoss
      : input.stopLoss - input.entryPrice;
  if (!Number.isFinite(riskPerUnit) || riskPerUnit <= 0) return 0;

  const rewardPerUnit =
    input.direction === "long"
      ? input.exitPrice - input.entryPrice
      : input.entryPrice - input.exitPrice;

  const pnl = (rewardPerUnit / riskPerUnit) * input.riskUsd;
  if (!Number.isFinite(pnl)) return 0;
  return Number(pnl.toFixed(2));
}

export function LogTradeDialog(props: LogTradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftTrade>(initialDraft);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof DraftTrade>(key: K, value: DraftTrade[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const entryPrice = parseNumber(draft.entryPrice);
    const exitPrice = draft.exitPrice.trim() ? parseNumber(draft.exitPrice) : null;
    const stopLoss = parseNumber(draft.stopLoss);
    const riskUsd = parseNumber(draft.riskUsd);
    const calculatedPnlUsd =
      draft.status === "closed" && typeof exitPrice === "number"
        ? computeClosedTradePnlUsd({
            direction: draft.direction,
            entryPrice,
            exitPrice,
            stopLoss,
            riskUsd,
          })
        : 0;

    const payload = {
      coin: draft.coin,
      direction: draft.direction,
      entryPrice,
      exitPrice,
      stopLoss,
      riskUsd,
      takeProfits: draft.takeProfits
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => Number(value)),
      pnlUsd: calculatedPnlUsd,
      leverage: draft.leverage,
      setup: draft.setup,
      executionGrade: draft.executionGrade,
      status: draft.status,
      entryDate: draft.entryDate,
      exitDate: draft.exitDate.trim() || null,
      notes: draft.notes,
      tags: draft.tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };

    const parsed = tradeFormSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Unable to save trade");
      console.error("[workspace/journal-ui] trade validation failed");
      return;
    }

    console.info(
      `[workspace/journal-ui] trade validated coin=${parsed.data.coin.toUpperCase()} status=${parsed.data.status} pnl=${parsed.data.pnlUsd ?? 0}`,
    );
    props.onCreate?.(parsed.data);
    setDraft(initialDraft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="size-4" />
          Log Trade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl border-border/70 bg-card/95">
        <DialogHeader>
          <DialogTitle>Log Trade</DialogTitle>
          <DialogDescription>Capture setup, execution context, and post-trade outcome.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trade-coin">Coin</Label>
              <Input id="trade-coin" value={draft.coin} onChange={(event) => setField("coin", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-direction">Direction</Label>
              <select
                id="trade-direction"
                value={draft.direction}
                onChange={(event) => setField("direction", event.target.value as DraftTrade["direction"])}
                className="h-9 w-full rounded-md border border-border/70 bg-background/45 px-3 text-sm"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-entry-price">Entry Price</Label>
              <Input
                id="trade-entry-price"
                value={draft.entryPrice}
                onChange={(event) => setField("entryPrice", event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-exit-price">Exit Price</Label>
              <Input
                id="trade-exit-price"
                value={draft.exitPrice}
                onChange={(event) => setField("exitPrice", event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-stop-loss">Stop Loss</Label>
              <Input
                id="trade-stop-loss"
                value={draft.stopLoss}
                onChange={(event) => setField("stopLoss", event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-risk">Risk ($)</Label>
              <Input
                id="trade-risk"
                value={draft.riskUsd}
                onChange={(event) => setField("riskUsd", event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-status">Status</Label>
              <select
                id="trade-status"
                value={draft.status}
                onChange={(event) => setField("status", event.target.value as DraftTrade["status"])}
                className="h-9 w-full rounded-md border border-border/70 bg-background/45 px-3 text-sm"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-grade">Execution Grade</Label>
              <select
                id="trade-grade"
                value={draft.executionGrade}
                onChange={(event) => setField("executionGrade", event.target.value as DraftTrade["executionGrade"])}
                className="h-9 w-full rounded-md border border-border/70 bg-background/45 px-3 text-sm"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-entry-date">Entry Date</Label>
              <Input
                id="trade-entry-date"
                type="date"
                value={draft.entryDate}
                onChange={(event) => setField("entryDate", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-exit-date">Exit Date</Label>
              <Input
                id="trade-exit-date"
                type="date"
                value={draft.exitDate}
                onChange={(event) => setField("exitDate", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-setup">Setup / Playbook</Label>
              <Input id="trade-setup" value={draft.setup} onChange={(event) => setField("setup", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-leverage">Leverage</Label>
              <Input
                id="trade-leverage"
                value={draft.leverage}
                onChange={(event) => setField("leverage", event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="trade-tp">Take Profits (comma separated)</Label>
              <Input
                id="trade-tp"
                value={draft.takeProfits}
                onChange={(event) => setField("takeProfits", event.target.value)}
                placeholder="68000, 69000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="trade-tags">Tags (comma separated)</Label>
              <Input
                id="trade-tags"
                value={draft.tags}
                onChange={(event) => setField("tags", event.target.value)}
                placeholder="breakout, momentum"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="trade-notes">Trade Notes</Label>
              <Textarea
                id="trade-notes"
                value={draft.notes}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder="What was the thesis? What did you learn?"
                className="min-h-24"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Trade</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
