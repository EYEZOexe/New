"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MarketInstrument } from "@/app/workspace/lib/types";

type MarketsTableProps = {
  rows: MarketInstrument[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function MarketsTable(props: MarketsTableProps) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.rows;
    return props.rows.filter(
      (row) => row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
    );
  }, [props.rows, query]);

  useEffect(() => {
    console.info(
      `[workspace/markets] query="${query.trim()}" total=${props.rows.length} filtered=${filteredRows.length}`,
    );
  }, [filteredRows.length, props.rows.length, query]);

  return (
    <Card className="site-panel">
      <CardHeader className="flex flex-row items-center justify-between px-0 pb-3">
        <CardTitle className="text-base">Markets</CardTitle>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbol..."
            className="h-9 rounded-full border-border/70 bg-background/45 pl-9"
            aria-label="Search markets"
          />
        </div>
      </CardHeader>

      <CardContent className="px-0">
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/35">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border/70 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">1h</th>
                <th className="px-4 py-3">24h</th>
                <th className="px-4 py-3">Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                    No markets match your current search.
                  </td>
                </tr>
              ) : null}
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.symbol}</p>
                    <p className="text-xs text-muted-foreground">{row.name}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatMoney(row.price)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={row.change1h >= 0 ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}
                    >
                      {row.change1h >= 0 ? "+" : ""}
                      {row.change1h.toFixed(2)}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={row.change24h >= 0 ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}
                    >
                      {row.change24h >= 0 ? "+" : ""}
                      {row.change24h.toFixed(2)}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{formatMoney(row.marketCap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
