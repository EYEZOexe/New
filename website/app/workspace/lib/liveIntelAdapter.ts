import type { LiveIntelCard } from "./types";

type LiveIntelInput = Partial<LiveIntelCard> | null | undefined;

const DEFAULT_PANEL = "market-movers";

const timeframeWeight: Record<LiveIntelCard["timeframe"], number> = {
  "5m": 0,
  "15m": 1,
  "1h": 2,
  "4h": 3,
  "1d": 4,
};

function sanitizeTimeframe(value: unknown): LiveIntelCard["timeframe"] {
  if (value === "5m" || value === "15m" || value === "1h" || value === "4h" || value === "1d") {
    return value;
  }
  return "1h";
}

function sanitizeSentiment(value: unknown): LiveIntelCard["sentiment"] {
  if (value === "bullish" || value === "bearish" || value === "neutral") {
    return value;
  }
  return "neutral";
}

function sanitizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeLiveIntelCards(input: LiveIntelInput[] | null | undefined): LiveIntelCard[] {
  if (!input?.length) return [];

  const cards = input
    .map((item, index): LiveIntelCard | null => {
      const title = item?.title?.trim();
      if (!title) return null;

      const timeframe = sanitizeTimeframe(item?.timeframe);
      return {
        id: item?.id?.trim() || `intel-${index}`,
        panel: item?.panel?.trim() || DEFAULT_PANEL,
        title,
        value: sanitizeNumber(item?.value),
        changePct: sanitizeNumber(item?.changePct),
        timeframe,
        sentiment: sanitizeSentiment(item?.sentiment),
      };
    })
    .filter((item): item is LiveIntelCard => item !== null);

  cards.sort((left, right) => {
    const absDiff = Math.abs(right.changePct) - Math.abs(left.changePct);
    if (absDiff !== 0) return absDiff;

    const timeframeDiff = timeframeWeight[right.timeframe] - timeframeWeight[left.timeframe];
    if (timeframeDiff !== 0) return timeframeDiff;

    return left.title.localeCompare(right.title);
  });

  return cards;
}

export function groupLiveIntelByPanel(cards: LiveIntelCard[]): Record<string, LiveIntelCard[]> {
  return cards.reduce<Record<string, LiveIntelCard[]>>((groups, card) => {
    const key = card.panel || DEFAULT_PANEL;
    const existing = groups[key] ?? [];
    existing.push(card);
    groups[key] = existing;
    return groups;
  }, {});
}

