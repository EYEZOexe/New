"use client";

import { useEffect } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { NewsArticle } from "@/app/workspace/lib/types";

type NewsGridProps = {
  articles: NewsArticle[];
};

function formatAge(timestamp: number): string {
  if (!timestamp) return "Unknown";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function NewsGrid(props: NewsGridProps) {
  useEffect(() => {
    console.info(`[workspace/news] cards=${props.articles.length}`);
  }, [props.articles.length]);

  if (props.articles.length === 0) {
    return (
      <Card className="site-panel">
        <CardContent className="px-0 py-6 text-sm text-muted-foreground">
          No news articles are available for the selected view.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {props.articles.map((article) => (
        <Card
          key={article.id}
          className="site-soft site-card-hover h-full transition-colors hover:border-primary/45 hover:bg-background/55"
        >
          <CardContent className="space-y-3 px-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{article.source}</p>
              <p className="text-xs text-muted-foreground">{formatAge(article.publishedAt)}</p>
            </div>
            <p className="font-semibold leading-snug">{article.title}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{article.category}</p>
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline underline-offset-4"
            >
              Read article
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
