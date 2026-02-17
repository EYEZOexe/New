"use client";

import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StrategyDetailDialog } from "@/app/workspace/components/strategy-detail-dialog";

type StrategyItem = {
  id: string;
  analyst: string;
  strategy: string;
  description: string;
  tags: string[];
  body: string[];
};

type StrategyListProps = {
  items: StrategyItem[];
};

export function StrategyList(props: StrategyListProps) {
  return (
    <div className="space-y-3">
      {props.items.map((item) => (
        <Card key={item.id} className="site-panel">
          <CardContent className="space-y-3 px-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xl font-semibold">{item.analyst}</p>
                <p className="text-primary">{item.strategy}</p>
              </div>
              <StrategyDetailDialog
                trigger={
                  <Button variant="outline" className="rounded-full">
                    Open
                    <ChevronRight className="size-4" />
                  </Button>
                }
                analyst={item.analyst}
                strategy={item.strategy}
                description={item.description}
                tags={item.tags}
                sections={item.body.map((paragraph, index) => ({
                  title: `Step ${index + 1}`,
                  body: paragraph,
                }))}
              />
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={`${item.id}-${tag}`} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
