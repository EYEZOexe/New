import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NewsArticle } from "@/app/workspace/lib/types";

type NewsFeatureCardProps = {
  article: NewsArticle;
};

export function NewsFeatureCard(props: NewsFeatureCardProps) {
  return (
    <Card className="site-panel">
      <CardContent className="grid gap-4 px-0 lg:grid-cols-[1fr_1.35fr] lg:items-stretch">
        <div className="rounded-2xl border border-border/70 bg-background/45 p-5">
          <p className="site-kicker">Source</p>
          <p className="mt-3 text-2xl font-semibold">{props.article.source}</p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/35 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Featured</Badge>
            <Badge variant="outline">{props.article.category}</Badge>
          </div>
          <h2 className="text-2xl font-semibold leading-tight">{props.article.title}</h2>
          <a
            className="text-sm font-semibold text-primary underline underline-offset-4"
            href={props.article.url}
            target="_blank"
            rel="noreferrer"
          >
            Open article
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

