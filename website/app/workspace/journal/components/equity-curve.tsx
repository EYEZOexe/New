"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { EquityPoint } from "@/app/workspace/lib/journalMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EquityCurveProps = {
  points: EquityPoint[];
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function EquityCurve(props: EquityCurveProps) {
  if (props.points.length < 2) {
    return (
      <Card className="site-panel">
        <CardHeader className="px-0 pb-2">
          <CardTitle className="text-base">Equity Curve</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-56 items-center justify-center px-0 text-sm text-muted-foreground">
          Need at least 2 closed trades
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="site-panel">
      <CardHeader className="px-0 pb-2">
        <CardTitle className="text-base">Equity Curve</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <LineChart data={props.points} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => `$${Math.round(value)}`}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                formatter={(value: number) => formatUsd(value)}
                labelFormatter={(label: string) => `Date: ${label}`}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "oklch(0.36 0.02 250 / 0.8)",
                  backgroundColor: "oklch(0.2 0.02 252 / 0.95)",
                }}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="oklch(0.73 0.16 215)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
