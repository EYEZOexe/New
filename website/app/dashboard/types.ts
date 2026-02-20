import type { ViewerConnectorOption } from "@/app/workspace/lib/connectorSelection";

export type SubscriptionTier = "basic" | "advanced" | "pro";

export type SignalAttachment = {
  attachmentId?: string;
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
};

export type SignalRow = {
  _id: string;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
  sourceGuildId: string;
  sourceChannelId: string;
  content: string;
  attachments?: SignalAttachment[];
};

export type MappingRow = {
  _id: string;
  sourceChannelId: string;
  dashboardEnabled?: boolean;
  minimumTier?: SubscriptionTier;
};

export type ViewerRow = {
  userId: string;
  email: string | null;
  name: string | null;
  tier: SubscriptionTier | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  subscriptionEndsAt: number | null;
  hasSignalAccess: boolean;
};

export type DiscordLinkRow = {
  isLinked: boolean;
  discordUserId: string | null;
  username: string | null;
  linkedAt: number | null;
};

export type LinkViewerDiscordResult = {
  ok: boolean;
  isLinked: boolean;
  discordUserId: string;
  username: string | null;
  linkedAt: number;
};

export type UnlinkViewerDiscordResult = {
  ok: boolean;
  unlinked: boolean;
};

export type SignalState =
  | "no_access"
  | "loading"
  | "has_signals"
  | "no_visible_config"
  | "tier_locked"
  | "empty";

export type CheckoutDiscordCompletePayload = {
  ok?: boolean;
  discord_user_id?: string;
  username?: string | null;
  linked_at?: number;
  message?: string;
};

export type { ViewerConnectorOption };
