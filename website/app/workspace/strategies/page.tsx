import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";

import { StrategyList } from "./components/strategy-list";

const strategies = [
  {
    id: "s-1",
    analyst: "Sveezy",
    strategy: "Breakout Framework",
    description: "Volume-based breakout strategy focused on clean breaks through resistance with expansion space.",
    tags: ["Breakout", "Momentum", "5M", "1H"],
    body: [
      "Identify a clear resistance that has been respected multiple times on higher timeframe.",
      "Check for a visible low-volume gap above resistance to avoid immediate chop.",
      "Drop to execution timeframe and confirm structure break with volume participation.",
    ],
  },
  {
    id: "s-2",
    analyst: "Soul",
    strategy: "Level-to-Level Scalping",
    description: "Momentum scalping setup using level reaction and profile confirmation.",
    tags: ["Scalping", "Momentum", "1M", "15M"],
    body: [
      "Anchor around prior session high/low and immediate value area boundaries.",
      "Only execute when order flow confirms continuation off the chosen level.",
      "Reduce size aggressively when volatility compression appears.",
    ],
  },
];

export default function StrategiesPage() {
  return (
    <>
      <WorkspaceSectionHeader
        title="Strategies"
        description="Analyst playbooks and execution frameworks with tactical filtering."
      />

      <Card className="site-soft">
        <CardContent className="flex flex-wrap items-center gap-2 px-0">
          <Badge variant="outline">All Strategies</Badge>
          <Badge variant="outline">Scalping</Badge>
          <Badge variant="outline">Swing</Badge>
          <Badge variant="outline">Breakout</Badge>
          <Badge variant="outline">Reversal</Badge>
        </CardContent>
      </Card>

      <StrategyList items={strategies} />
    </>
  );
}

