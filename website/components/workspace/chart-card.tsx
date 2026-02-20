"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartCardProps = {
  title: string;
  values: number[];
  color?: string;
  height?: number;
};

export function ChartCard(props: ChartCardProps) {
  const gradientId = useId();
  const data =
    props.values.length > 0
      ? props.values.map((value, index) => ({ index, value }))
      : [
          { index: 0, value: 0 },
          { index: 1, value: 0 },
        ];

  const stroke = props.color ?? "oklch(0.73 0.16 215)";

  return (
    <Card className="site-soft site-card-hover h-full">
      <CardHeader className="px-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{props.title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div style={{ width: "100%", height: props.height ?? 90 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={false}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "oklch(0.36 0.02 250 / 0.8)",
                  backgroundColor: "oklch(0.2 0.02 252 / 0.95)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                fill={`url(#${gradientId})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
