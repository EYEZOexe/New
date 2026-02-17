import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type NavLink = {
  href: string;
  label: string;
};

type SectionHeaderProps = {
  badge: string;
  title: string;
  subtitle: string;
  navLinks?: NavLink[];
  actions?: ReactNode;
};

export function SectionHeader(props: SectionHeaderProps) {
  return (
    <Card className="site-panel">
      <CardContent className="flex flex-wrap items-start justify-between gap-4 px-0">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-100">
            {props.badge}
          </Badge>
          <h1 className="site-title mt-4">{props.title}</h1>
          <p className="site-subtitle">{props.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.navLinks?.map((link) => (
            <Button key={link.href} asChild size="sm" variant="ghost">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          {props.actions}
        </div>
      </CardContent>
    </Card>
  );
}
