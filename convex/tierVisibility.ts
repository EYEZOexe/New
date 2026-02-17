export type SubscriptionTier = "basic" | "advanced" | "pro";

type VisibilityRule = {
  channelId: string;
  dashboardEnabled?: boolean;
  minimumTier?: SubscriptionTier | null;
};

const ORDER: SubscriptionTier[] = ["basic", "advanced", "pro"];

function tierRank(tier: SubscriptionTier): number {
  return ORDER.indexOf(tier);
}

export function isTierAtLeast(
  current: SubscriptionTier | null | undefined,
  minimum: SubscriptionTier,
): boolean {
  if (!current) return false;
  return tierRank(current) >= tierRank(minimum);
}

export function filterVisibleChannelIdsForTier(
  currentTier: SubscriptionTier | null | undefined,
  rules: VisibilityRule[],
): string[] {
  const visible = new Set<string>();

  for (const rule of rules) {
    const channelId = rule.channelId.trim();
    if (!channelId) continue;
    if (rule.dashboardEnabled !== true) continue;
    if (!rule.minimumTier) continue;
    if (!isTierAtLeast(currentTier, rule.minimumTier)) continue;
    visible.add(channelId);
  }

  return Array.from(visible);
}
