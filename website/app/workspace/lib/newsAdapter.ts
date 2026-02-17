import type { NewsArticle } from "./types";

type NewsInput = Partial<NewsArticle> | null | undefined;

function sanitizeTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return 0;
}

export function normalizeNewsArticles(input: NewsInput[] | null | undefined): NewsArticle[] {
  if (!input?.length) return [];

  const rows = input
    .map((item, index): NewsArticle | null => {
      const title = item?.title?.trim();
      const source = item?.source?.trim();
      const url = item?.url?.trim();
      if (!title || !source || !url) return null;

      return {
        id: item?.id?.trim() || `news-${index}`,
        source,
        title,
        url,
        category: item?.category?.trim() || "market",
        featured: item?.featured === true,
        publishedAt: sanitizeTimestamp(item?.publishedAt),
      };
    })
    .filter((item): item is NewsArticle => item !== null);

  rows.sort((left, right) => {
    if (left.publishedAt !== right.publishedAt) {
      return right.publishedAt - left.publishedAt;
    }
    return left.title.localeCompare(right.title);
  });

  return rows;
}

export function partitionFeaturedNews(rows: NewsArticle[]): {
  featured: NewsArticle | null;
  rest: NewsArticle[];
} {
  if (rows.length === 0) {
    return {
      featured: null,
      rest: [],
    };
  }

  const featured = rows.find((row) => row.featured) ?? rows[0];
  return {
    featured,
    rest: rows.filter((row) => row.id !== featured.id),
  };
}

