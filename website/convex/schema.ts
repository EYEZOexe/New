import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

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
    .index("by_sourceMessageId", ["sourceMessageId"])
    .index("by_createdAt", ["createdAt"]),

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
