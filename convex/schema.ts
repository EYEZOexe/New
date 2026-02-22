import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  connectors: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    tokenHash: v.string(),
    status: v.union(v.literal("active"), v.literal("paused")),
    forwardEnabled: v.optional(v.boolean()),
    configVersion: v.number(),
    discoveryRequestVersion: v.optional(v.number()),
    discoveryRequestedGuildId: v.optional(v.string()),
    discoveryRequestedAt: v.optional(v.number()),
    updatedAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_tenant_connectorId", ["tenantKey", "connectorId"])
    .index("by_tokenHash", ["tokenHash"]),

  connectorSources: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    channelId: v.string(),
    isSource: v.optional(v.boolean()),
    isTarget: v.optional(v.boolean()),
    threadMode: v.optional(
      v.union(v.literal("include"), v.literal("exclude"), v.literal("only")),
    ),
    isEnabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_tenant_connectorId", ["tenantKey", "connectorId"])
    .index("by_tenant_connector_channelId", ["tenantKey", "connectorId", "channelId"]),

  connectorMappings: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceChannelId: v.string(),
    targetChannelId: v.string(),
    dashboardEnabled: v.optional(v.boolean()),
    minimumTier: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    ),
    filtersJson: v.optional(v.any()),
    transformJson: v.optional(v.any()),
    priority: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_tenant_connectorId", ["tenantKey", "connectorId"])
    .index("by_tenant_connector_sourceChannelId", [
      "tenantKey",
      "connectorId",
      "sourceChannelId",
    ]),

  discordGuilds: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    name: v.string(),
    updatedAt: v.number(),
  }).index("by_tenant_connector_guildId", ["tenantKey", "connectorId", "guildId"]),

  discordBotGuilds: defineTable({
    guildId: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    active: v.boolean(),
    lastSeenAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_active", ["active"]),

  discordChannels: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    channelId: v.string(),
    guildId: v.string(),
    name: v.string(),
    type: v.optional(v.number()),
    parentId: v.optional(v.string()),
    position: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_tenant_connector_channelId", ["tenantKey", "connectorId", "channelId"])
    .index("by_tenant_connector_guildId", ["tenantKey", "connectorId", "guildId"]),

  threads: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    threadId: v.string(),
    parentChannelId: v.string(),
    guildId: v.string(),
    name: v.string(),
    archived: v.boolean(),
    locked: v.boolean(),
    memberCount: v.optional(v.number()),
    messageCount: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_tenant_connector_threadId", ["tenantKey", "connectorId", "threadId"])
    .index("by_tenant_connector_parentChannelId", [
      "tenantKey",
      "connectorId",
      "parentChannelId",
    ]),

  subscriptions: defineTable({
    userId: v.id("users"),
    tier: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    ),
    billingMode: v.optional(
      v.union(v.literal("recurring"), v.literal("fixed_term")),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("canceled"),
      v.literal("past_due"),
    ),
    variantId: v.optional(v.string()),
    productId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    source: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_status_endsAt", ["status", "endsAt"]),

  sellAccessPolicies: defineTable({
    scope: v.union(v.literal("product"), v.literal("variant")),
    externalId: v.string(),
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    billingMode: v.union(v.literal("recurring"), v.literal("fixed_term")),
    durationDays: v.optional(v.number()),
    enabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_scope_externalId", ["scope", "externalId"])
    .index("by_enabled", ["enabled"])
    .index("by_tier", ["tier"]),

  shopTiers: defineTable({
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    title: v.string(),
    subtitle: v.optional(v.string()),
    badge: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_tier", ["tier"])
    .index("by_active_sortOrder", ["active", "sortOrder"]),

  shopVariants: defineTable({
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    durationDays: v.number(),
    displayPrice: v.string(),
    priceSuffix: v.optional(v.string()),
    checkoutUrl: v.string(),
    highlights: v.optional(v.array(v.string())),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    active: v.boolean(),
    policyScope: v.union(v.literal("product"), v.literal("variant")),
    policyExternalId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_tier_durationDays", ["tier", "durationDays"])
    .index("by_active_tier_sortOrder", ["active", "tier", "sortOrder"])
    .index("by_policy_link", ["policyScope", "policyExternalId"]),

  marketSnapshots: defineTable({
    symbol: v.string(),
    name: v.string(),
    price: v.number(),
    change1h: v.number(),
    change24h: v.number(),
    marketCap: v.number(),
    volume24h: v.number(),
    fundingRate: v.optional(v.number()),
    high24h: v.optional(v.number()),
    low24h: v.optional(v.number()),
    sparkline7d: v.optional(v.array(v.number())),
    updatedAt: v.number(),
  })
    .index("by_symbol", ["symbol"])
    .index("by_updatedAt", ["updatedAt"]),

  liveIntelItems: defineTable({
    panel: v.string(),
    title: v.string(),
    value: v.number(),
    changePct: v.number(),
    timeframe: v.union(
      v.literal("5m"),
      v.literal("15m"),
      v.literal("1h"),
      v.literal("4h"),
      v.literal("1d"),
    ),
    sentiment: v.union(v.literal("bullish"), v.literal("bearish"), v.literal("neutral")),
    updatedAt: v.number(),
  })
    .index("by_panel", ["panel"])
    .index("by_updatedAt", ["updatedAt"]),

  indicatorAlerts: defineTable({
    panel: v.union(v.literal("oracle"), v.literal("watchlist")),
    title: v.string(),
    side: v.union(v.literal("bull"), v.literal("bear")),
    timeframe: v.string(),
    price: v.string(),
    eventDate: v.string(),
    live: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_panel_updatedAt", ["panel", "updatedAt"]),

  strategyEntries: defineTable({
    analyst: v.string(),
    strategy: v.string(),
    description: v.string(),
    tags: v.optional(v.array(v.string())),
    sections: v.optional(
      v.array(
        v.object({
          title: v.string(),
          body: v.string(),
        }),
      ),
    ),
    active: v.boolean(),
    updatedAt: v.number(),
  }).index("by_active_updatedAt", ["active", "updatedAt"]),

  journalTrades: defineTable({
    userId: v.id("users"),
    coin: v.string(),
    direction: v.union(v.literal("long"), v.literal("short")),
    entryPrice: v.number(),
    exitPrice: v.optional(v.number()),
    stopLoss: v.number(),
    riskUsd: v.number(),
    takeProfits: v.optional(v.array(v.number())),
    pnlUsd: v.optional(v.number()),
    leverage: v.string(),
    setup: v.string(),
    executionGrade: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D")),
    status: v.union(v.literal("open"), v.literal("closed")),
    entryDate: v.string(),
    exitDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_status", ["userId", "status"]),

  newsArticles: defineTable({
    source: v.string(),
    title: v.string(),
    url: v.string(),
    category: v.string(),
    publishedAt: v.number(),
    featured: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_publishedAt", ["publishedAt"])
    .index("by_featured_publishedAt", ["featured", "publishedAt"]),

  paymentCustomers: defineTable({
    provider: v.string(),
    userId: v.id("users"),
    externalCustomerId: v.optional(v.string()),
    externalSubscriptionId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    lastEventId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_provider_userId", ["provider", "userId"])
    .index("by_provider_externalCustomerId", ["provider", "externalCustomerId"])
    .index("by_provider_externalSubscriptionId", ["provider", "externalSubscriptionId"]),

  discordLinks: defineTable({
    userId: v.id("users"),
    discordUserId: v.string(),
    username: v.optional(v.string()),
    linkedAt: v.number(),
    unlinkedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_discordUserId", ["discordUserId"]),

  discordTierRoleMappings: defineTable({
    tier: v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    guildId: v.string(),
    roleId: v.string(),
    enabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_tier", ["tier"])
    .index("by_enabled", ["enabled"]),

  discordServerConfigs: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    seatLimit: v.number(),
    seatEnforcementEnabled: v.boolean(),
    basicRoleId: v.optional(v.string()),
    advancedRoleId: v.optional(v.string()),
    proRoleId: v.optional(v.string()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_tenant_connector", ["tenantKey", "connectorId"])
    .index("by_tenant_connector_guild", ["tenantKey", "connectorId", "guildId"]),

  discordServerSeatSnapshots: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    seatsUsed: v.number(),
    seatLimit: v.number(),
    isOverLimit: v.boolean(),
    status: v.union(v.literal("fresh"), v.literal("stale"), v.literal("expired")),
    checkedAt: v.number(),
    nextCheckAfter: v.number(),
    lastError: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_tenant_connector", ["tenantKey", "connectorId"])
    .index("by_tenant_connector_guild", ["tenantKey", "connectorId", "guildId"])
    .index("by_status_nextCheckAfter", ["status", "nextCheckAfter"]),

  discordSeatAuditJobs: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    guildId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    source: v.optional(v.string()),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    runAfter: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    claimedAt: v.optional(v.number()),
    claimToken: v.optional(v.string()),
    claimWorkerId: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_status_runAfter", ["status", "runAfter"])
    .index("by_tenant_connector", ["tenantKey", "connectorId"])
    .index("by_dedupe", ["tenantKey", "connectorId", "guildId", "status"]),

  roleSyncJobs: defineTable({
    userId: v.id("users"),
    discordUserId: v.string(),
    guildId: v.string(),
    roleId: v.string(),
    action: v.union(v.literal("grant"), v.literal("revoke")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    source: v.optional(v.string()),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    runAfter: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    claimedAt: v.optional(v.number()),
    claimToken: v.optional(v.string()),
    claimWorkerId: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_status_runAfter", ["status", "runAfter"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_discordUserId_status", ["discordUserId", "status"])
    .index("by_dedupe", [
      "userId",
      "discordUserId",
      "guildId",
      "roleId",
      "action",
      "status",
    ]),

  signalMirrorJobs: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceMessageId: v.string(),
    sourceChannelId: v.string(),
    sourceGuildId: v.string(),
    targetChannelId: v.string(),
    targetGuildId: v.optional(v.string()),
    eventType: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
    ),
    content: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          attachmentId: v.optional(v.string()),
          url: v.string(),
          name: v.optional(v.string()),
          contentType: v.optional(v.string()),
          size: v.optional(v.number()),
        }),
      ),
    ),
    sourceCreatedAt: v.number(),
    sourceEditedAt: v.optional(v.number()),
    sourceDeletedAt: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    runAfter: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    claimedAt: v.optional(v.number()),
    claimToken: v.optional(v.string()),
    claimWorkerId: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_status_runAfter", ["status", "runAfter"])
    .index("by_tenant_connector", ["tenantKey", "connectorId"])
    .index("by_dedupe", [
      "tenantKey",
      "connectorId",
      "sourceMessageId",
      "targetChannelId",
      "eventType",
      "status",
    ]),

  mirroredSignals: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceMessageId: v.string(),
    targetChannelId: v.string(),
    mirroredMessageId: v.string(),
    mirroredExtraMessageIds: v.optional(v.array(v.string())),
    mirroredGuildId: v.optional(v.string()),
    lastMirroredAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_tenant_connector", ["tenantKey", "connectorId"])
    .index("by_source_target", [
      "tenantKey",
      "connectorId",
      "sourceMessageId",
      "targetChannelId",
    ]),

  signals: defineTable({
    tenantKey: v.string(),
    connectorId: v.string(),
    sourceMessageId: v.string(),
    sourceChannelId: v.string(),
    sourceGuildId: v.string(),
    content: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          attachmentId: v.optional(v.string()),
          url: v.string(),
          name: v.optional(v.string()),
          contentType: v.optional(v.string()),
          size: v.optional(v.number()),
        }),
      ),
    ),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_sourceMessageId", ["tenantKey", "connectorId", "sourceMessageId"])
    .index("by_createdAt", ["tenantKey", "connectorId", "createdAt"]),

  webhookEvents: defineTable({
    provider: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    payload: v.any(),
    payloadHash: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    externalCustomerId: v.optional(v.string()),
    externalSubscriptionId: v.optional(v.string()),
    resolvedUserId: v.optional(v.id("users")),
    resolvedVia: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    attemptCount: v.optional(v.number()),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  })
    .index("by_provider_eventId", ["provider", "eventId"])
    .index("by_provider_status", ["provider", "status"])
    .index("by_status", ["status"]),
});
