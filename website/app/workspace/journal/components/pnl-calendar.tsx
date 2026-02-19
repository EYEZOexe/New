"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import type { DailyPnlPoint } from "@/app/workspace/lib/journalMetrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PnlCalendarProps = {
  points: DailyPnlPoint[];
};

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PnlCalendar(props: PnlCalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const pointsByDate = useMemo(() => {
    const map = new Map<string, DailyPnlPoint>();
    for (const point of props.points) {
      map.set(point.date, point);
    }
    return map;
  }, [props.points]);

  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingEmpty = firstDay.getDay();

    const nextCells: Array<
      | { kind: "empty"; id: string }
      | { kind: "day"; id: string; day: number; point: DailyPnlPoint | null }
    > = [];

    for (let index = 0; index < leadingEmpty; index += 1) {
      nextCells.push({ kind: "empty", id: `empty-${index}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = isoDate(date);
      nextCells.push({
        kind: "day",
        id: key,
        day,
        point: pointsByDate.get(key) ?? null,
      });
    }

    return nextCells;
  }, [monthCursor, pointsByDate]);

  return (
    <Card className="site-panel">
      <CardHeader className="flex flex-row items-center justify-between px-0 pb-2">
        <CardTitle className="text-base">P&L Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 rounded-full"
            onClick={() =>
              setMonthCursor(
                (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="min-w-28 text-center text-sm font-medium">
            {monthCursor.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </p>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 rounded-full"
            onClick={() =>
              setMonthCursor(
                (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-0">
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
          {weekDays.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((cell) =>
            cell.kind === "empty" ? (
              <div key={cell.id} className="h-14 rounded-lg border border-transparent" />
            ) : (
              <div
                key={cell.id}
                className={cn(
                  "flex h-14 flex-col items-center justify-center rounded-lg border text-sm",
                  "border-border/70 bg-background/45",
                  cell.point?.pnl && cell.point.pnl > 0 && "border-emerald-500/45 bg-emerald-500/10",
                  cell.point?.pnl && cell.point.pnl < 0 && "border-red-500/45 bg-red-500/10",
                )}
              >
                <span className="text-xs text-muted-foreground">{cell.day}</span>
                {cell.point ? (
                  <span className={cn("text-xs font-medium", cell.point.pnl >= 0 ? "text-emerald-300" : "text-red-300")}>
                    {cell.point.pnl >= 0 ? "+" : ""}
                    {cell.point.pnl.toFixed(0)}
                  </span>
                ) : null}
              </div>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}
