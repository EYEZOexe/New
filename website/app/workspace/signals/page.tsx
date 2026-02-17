import { Bell, Zap } from "lucide-react";

import { WorkspaceSectionHeader } from "@/components/workspace/workspace-section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { AnalystFeed } from "./components/analyst-feed";

const analysts = ["Soul", "Sveezy", "Badillusion"];

const feedItems = [
  {
    id: "signal-1",
    analyst: "Soul",
    handle: "@Soul Alerts",
    timeAgo: "23m ago",
    content: "BTC is still respecting the range low. Waiting for confirmation above reclaim level.",
    imageUrl: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=640&q=80&auto=format&fit=crop",
  },
  {
    id: "signal-2",
    analyst: "Sveezy",
    handle: "@Sveezy Desk",
    timeAgo: "54m ago",
    content: "PEPE momentum fade at local resistance. Watch for continuation only if volume rotates back in.",
  },
  {
    id: "signal-3",
    analyst: "Badillusion",
    handle: "@Badillusion Notes",
    timeAgo: "1h ago",
    content: "SOL reclaim setup active. Protect downside if reclaim candle loses momentum.",
  },
];

export default function SignalsPage() {
  return (
    <>
      <WorkspaceSectionHeader
        title="Signals & Alerts"
        description="Follow analyst signal flow, volatility alerts, and desk-level updates in one feed."
        actions={
          <Badge variant="outline" className="rounded-full border-emerald-500/40 text-emerald-300">
            <Bell className="size-3" />
            Live updates
          </Badge>
        }
      />

      <Card className="site-soft">
        <CardContent className="flex items-center justify-between gap-3 px-0">
          <div>
            <p className="font-semibold">Notification Settings</p>
            <p className="text-sm text-muted-foreground">All notifications currently off.</p>
          </div>
          <Badge variant="outline">
            <Zap className="size-3" />
            Configure
          </Badge>
        </CardContent>
      </Card>

      <AnalystFeed analysts={analysts} items={feedItems} />
    </>
  );
}

