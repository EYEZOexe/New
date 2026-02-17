"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DetailDialog } from "@/components/workspace/detail-dialog";

type StrategyDetailDialogProps = {
  trigger: ReactNode;
  analyst: string;
  strategy: string;
  description: string;
  tags: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
};

export function StrategyDetailDialog(props: StrategyDetailDialogProps) {
  return (
    <DetailDialog
      trigger={props.trigger}
      title={`${props.analyst} • ${props.strategy}`}
      description={props.description}
      contentClassName="max-w-4xl border-border/70 bg-card/95"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {props.tags.map((tag) => (
            <Badge key={`${props.strategy}-${tag}`} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="space-y-4">
          {props.sections.map((section) => (
            <section key={`${props.strategy}-${section.title}`} className="space-y-1">
              <h3 className="text-base font-semibold">{section.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </DetailDialog>
  );
}

