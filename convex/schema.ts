import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Placeholder for access gating. This will be written by webhook ingestion later.
  subscriptions: defineTable({
    userId: v.id("users"),
    status: v.string(), // "active" | "inactive" | ...
    plan: v.optional(v.string()),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),
});

