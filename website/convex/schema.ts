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
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("canceled"),
      v.literal("past_due"),
    ),
    productId: v.optional(v.string()),
    source: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  discordLinks: defineTable({
    userId: v.id("users"),
    discordUserId: v.string(),
    username: v.optional(v.string()),
    linkedAt: v.number(),
    unlinkedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_discordUserId", ["discordUserId"]),

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
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  })
    .index("by_provider_eventId", ["provider", "eventId"])
    .index("by_status", ["status"]),
});
