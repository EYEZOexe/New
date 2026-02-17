"use client";

import { Card, CardContent } from "@/components/ui/card";

import { OverviewHero } from "./components/overview-hero";
import { OverviewSignalFeed } from "./components/overview-signal-feed";
import { useOverviewController } from "./useOverviewController";

export default function WorkspaceOverviewPage() {
  const overview = useOverviewController();

  if (overview.isLoading) {
    return (
      <Card className="site-panel">
        <CardContent className="px-0">
          <p className="text-sm text-muted-foreground">Checking session...</p>
        </CardContent>
      </Card>
    );
  }

  if (!overview.isAuthenticated) {
    return null;
  }

  return (
    <>
      <OverviewHero overview={overview} />
      <OverviewSignalFeed overview={overview} />
    </>
  );
}
