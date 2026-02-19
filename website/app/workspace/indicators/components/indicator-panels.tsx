import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IndicatorAlert = {
  id: string;
  title: string;
  side: "bull" | "bear";
  timeframe: string;
  price: string;
  date: string;
};

type IndicatorPanelsProps = {
  oracleAlerts: IndicatorAlert[];
  watchlistAlerts: IndicatorAlert[];
};

function AlertList(props: { alerts: IndicatorAlert[] }) {
  if (props.alerts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
        No alerts available for this panel right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {props.alerts.map((alert) => (
        <article key={alert.id} className="rounded-xl border border-border/70 bg-background/45 p-3.5 transition-colors hover:border-primary/45 hover:bg-background/55">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{alert.title}</p>
            <p className="text-xs text-muted-foreground">{alert.date}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{alert.timeframe}</Badge>
            <Badge
              variant="outline"
              className={alert.side === "bull" ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}
            >
              {alert.side === "bull" ? "Bullish" : "Bearish"}
            </Badge>
            <Badge variant="outline">Price {alert.price}</Badge>
          </div>
        </article>
      ))}
    </div>
  );
}

export function IndicatorPanels(props: IndicatorPanelsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="site-panel">
        <CardHeader className="px-0 pb-3">
          <CardTitle className="text-base">Oracle Alerts</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AlertList alerts={props.oracleAlerts} />
        </CardContent>
      </Card>

      <Card className="site-panel">
        <CardHeader className="px-0 pb-3">
          <CardTitle className="text-base">MSS Watchlist</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AlertList alerts={props.watchlistAlerts} />
        </CardContent>
      </Card>
    </div>
  );
}
