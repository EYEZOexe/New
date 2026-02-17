import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

const days = Array.from({ length: 28 }, (_, index) => index + 1);

export function PnlCalendar() {
  return (
    <Card className="site-panel">
      <CardHeader className="px-0 pb-2">
        <CardTitle className="text-base">P&L Calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-0">
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
          {weekDays.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => (
            <div
              key={day}
              className={`flex h-12 items-center justify-center rounded-lg border border-border/70 bg-background/45 text-sm ${
                day === 17 ? "border-primary/80 text-primary" : ""
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

