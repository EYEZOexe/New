import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  normalizeEmail,
  projectSellWebhookPayload,
  type SubscriptionStatus,
} from "./paymentsUtils";

const PROVIDER = "sellapp";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

async function getWebhookEventByKey(
  ctx: MutationCtx,
  provider: string,
  eventId: string,
): Promise<Doc<"webhookEvents"> | null> {
  return await ctx.db
    .query("webhookEvents")
    .withIndex("by_provider_eventId", (q) => q.eq("provider", provider).eq("eventId", eventId))
    .first();
}

async function findUserByEmail(
  ctx: MutationCtx,
  email: string,
): Promise<{ id: Id<"users">; email: string } | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    if (normalizeEmail(typeof user.email === "string" ? user.email : null) === normalized) {
      return {
        id: user._id,
        email: normalized,
      };
    }
  }

  return null;
}

async function upsertSubscriptionForUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    status: SubscriptionStatus;
    productId: string | null;
    now: number;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .first();

  if (!existing) {
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      status: args.status,
      productId: args.productId ?? undefined,
      source: PROVIDER,
      updatedAt: args.now,
    });
    return;
  }

  await ctx.db.patch(existing._id, {
    status: args.status,
    productId: args.productId ?? undefined,
    source: PROVIDER,
    updatedAt: args.now,
  });
}

export const upsertSellWebhookEvent = internalMutation({
  args: {
    provider: v.literal(PROVIDER),
    eventId: v.string(),
    eventType: v.string(),
    payload: v.any(),
    payloadHash: v.optional(v.string()),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await getWebhookEventByKey(ctx, args.provider, args.eventId);
    if (existing) {
      if (args.payloadHash && existing.payloadHash && existing.payloadHash !== args.payloadHash) {
        console.warn(
          `[payments] webhook payload hash mismatch provider=${args.provider} event=${args.eventId}`,
        );
      }

      return {
        created: false,
        status: existing.status,
        attemptCount: existing.attemptCount ?? 0,
      };
    }

    await ctx.db.insert("webhookEvents", {
      provider: args.provider,
      eventId: args.eventId,
      eventType: args.eventType,
      payload: args.payload,
      payloadHash: args.payloadHash,
      receivedAt: args.receivedAt,
      status: "received",
      attemptCount: 0,
    });

    return {
      created: true,
      status: "received" as const,
      attemptCount: 0,
    };
  },
});

export const processSellWebhookEvent = internalMutation({
  args: {
    provider: v.literal(PROVIDER),
    eventId: v.string(),
    attemptedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const event = await getWebhookEventByKey(ctx, args.provider, args.eventId);
    if (!event) {
      throw new Error("webhook_event_not_found");
    }

    if (event.status === "processed") {
      const projected = projectSellWebhookPayload(event.payload, event.eventId);
      return {
        deduped: true,
        subscriptionStatus: projected.subscriptionStatus,
        userId: null as Id<"users"> | null,
      };
    }

    const nextAttempt = (event.attemptCount ?? 0) + 1;
    await ctx.db.patch(event._id, {
      attemptCount: nextAttempt,
      lastAttemptAt: args.attemptedAt,
      error: undefined,
      status: "received",
    });

    try {
      const projected = projectSellWebhookPayload(event.payload, event.eventId);
      const email = normalizeEmail(projected.customerEmail);
      if (!email) {
        throw new Error("missing_customer_email");
      }

      const user = await findUserByEmail(ctx, email);
      if (!user) {
        throw new Error(`user_not_found:${email}`);
      }

      await upsertSubscriptionForUser(ctx, {
        userId: user.id,
        status: projected.subscriptionStatus,
        productId: projected.productId,
        now: args.attemptedAt,
      });

      await ctx.db.patch(event._id, {
        eventType: projected.eventType,
        status: "processed",
        processedAt: args.attemptedAt,
        lastAttemptAt: args.attemptedAt,
        error: undefined,
      });

      console.info(
        `[payments] processed webhook provider=${args.provider} event=${args.eventId} user=${user.email} status=${projected.subscriptionStatus} attempts=${nextAttempt}`,
      );

      return {
        deduped: false,
        subscriptionStatus: projected.subscriptionStatus,
        userId: user.id,
      };
    } catch (error) {
      const message = getErrorMessage(error);

      await ctx.db.patch(event._id, {
        status: "failed",
        error: message,
        lastAttemptAt: args.attemptedAt,
      });

      console.error(
        `[payments] failed webhook provider=${args.provider} event=${args.eventId} attempts=${nextAttempt} error=${message}`,
      );

      throw new Error(message);
    }
  },
});

export const listFailedSellWebhookEvents = internalQuery({
  args: {
    provider: v.literal(PROVIDER),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, args.limit ?? 50));
    const failures = await ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_status", (q) =>
        q.eq("provider", args.provider).eq("status", "failed"),
      )
      .order("desc")
      .take(limit);

    return failures.map((event) => ({
        provider: event.provider,
        eventId: event.eventId,
        eventType: event.eventType,
        receivedAt: event.receivedAt,
        lastAttemptAt: event.lastAttemptAt ?? null,
        attemptCount: event.attemptCount ?? 0,
        error: event.error ?? null,
      }));
  },
});
