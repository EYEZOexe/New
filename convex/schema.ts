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
