import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type NavLink = {
  href: string;
  label: string;
};

type HeaderHighlight = {
  label: string;
  value: string;
};

type SectionHeaderProps = {
  badge: string;
  title: string;
  subtitle: string;
  navLinks?: NavLink[];
  actions?: ReactNode;
  highlights?: HeaderHighlight[];
};

export function SectionHeader(props: SectionHeaderProps) {
  return (
    <Card className="site-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
      <CardContent className="space-y-7 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-full border border-cyan-300/25 bg-cyan-400/15 px-3 py-1 text-cyan-100"
            >
              {props.badge}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">Realtime signal workspace</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {props.navLinks?.map((link) => (
              <Button
                key={link.href}
                asChild
                size="sm"
                variant="ghost"
                className="rounded-full border border-border/70 bg-background/35 px-4"
              >
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
            {props.actions}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-4xl">
            <h1 className="site-title">{props.title}</h1>
            <p className="site-subtitle">{props.subtitle}</p>
          </div>

          {props.highlights?.length ? (
            <div className="grid gap-2 sm:grid-cols-3 lg:w-[340px] lg:grid-cols-1">
              {props.highlights.map((item) => (
                <div key={item.label} className="site-metric">
                  <p className="site-kicker">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
