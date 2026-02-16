import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery, query } from "./_generated/server";
import {
  normalizeEmail,
  projectSellWebhookPayload,
  type SubscriptionStatus,
} from "./paymentsUtils";
import {
  resolveEnabledSellAccessPolicy,
  type BillingMode,
  type SubscriptionTier,
} from "./sellAccessPolicies";
import {
  enqueueRoleSyncJobsForSubscription,
} from "./roleSyncQueue";

const PROVIDER = "sellapp";
type UserResolutionMethod =
  | "payment_subscription_id"
  | "payment_customer_id"
  | "email";

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

async function findPaymentCustomerByExternalSubscriptionId(
  ctx: MutationCtx,
  externalSubscriptionId: string,
): Promise<Doc<"paymentCustomers"> | null> {
  const rows = await ctx.db.query("paymentCustomers").collect();
  return (
    rows.find(
      (row) =>
        row.provider === PROVIDER &&
        row.externalSubscriptionId === externalSubscriptionId,
    ) ?? null
  );
}

async function findPaymentCustomerByExternalCustomerId(
  ctx: MutationCtx,
  externalCustomerId: string,
): Promise<Doc<"paymentCustomers"> | null> {
  const rows = await ctx.db.query("paymentCustomers").collect();
  return (
    rows.find(
      (row) =>
        row.provider === PROVIDER &&
        row.externalCustomerId === externalCustomerId,
    ) ?? null
  );
}

async function resolveUserFromPaymentTracking(
  ctx: MutationCtx,
  args: {
    externalCustomerId: string | null;
    externalSubscriptionId: string | null;
    customerEmail: string | null;
  },
): Promise<{ id: Id<"users">; email: string | null; method: UserResolutionMethod } | null> {
  if (args.externalSubscriptionId) {
    const bySubscription = await findPaymentCustomerByExternalSubscriptionId(
      ctx,
      args.externalSubscriptionId,
    );
    if (bySubscription) {
      const user = await ctx.db.get(bySubscription.userId);
      if (user) {
        return {
          id: user._id,
          email: typeof user.email === "string" ? user.email : null,
          method: "payment_subscription_id",
        };
      }
    }
  }

  if (args.externalCustomerId) {
    const byCustomer = await findPaymentCustomerByExternalCustomerId(
      ctx,
      args.externalCustomerId,
    );
    if (byCustomer) {
      const user = await ctx.db.get(byCustomer.userId);
      if (user) {
        return {
          id: user._id,
          email: typeof user.email === "string" ? user.email : null,
          method: "payment_customer_id",
        };
      }
    }
  }

  if (args.customerEmail) {
    const byEmail = await findUserByEmail(ctx, args.customerEmail);
    if (byEmail) {
      return {
        id: byEmail.id,
        email: byEmail.email,
        method: "email",
      };
    }
  }

  return null;
}

async function upsertPaymentCustomerTracking(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    eventId: string;
    externalCustomerId: string | null;
    externalSubscriptionId: string | null;
    customerEmail: string | null;
    now: number;
  },
): Promise<void> {
  let existing: Doc<"paymentCustomers"> | null = null;

  if (args.externalSubscriptionId) {
    existing = await findPaymentCustomerByExternalSubscriptionId(
      ctx,
      args.externalSubscriptionId,
    );
  }

  if (!existing && args.externalCustomerId) {
    existing = await findPaymentCustomerByExternalCustomerId(ctx, args.externalCustomerId);
  }

  if (!existing) {
    const byUserRows = await ctx.db.query("paymentCustomers").collect();
    existing =
      byUserRows.find(
        (row) => row.provider === PROVIDER && row.userId === args.userId,
      ) ?? null;
  }

  const next = {
    provider: PROVIDER,
    userId: args.userId,
    externalCustomerId:
      args.externalCustomerId ?? existing?.externalCustomerId ?? undefined,
    externalSubscriptionId:
      args.externalSubscriptionId ?? existing?.externalSubscriptionId ?? undefined,
    customerEmail: args.customerEmail ?? existing?.customerEmail ?? undefined,
    lastEventId: args.eventId,
    updatedAt: args.now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, next);
    return;
  }

  await ctx.db.insert("paymentCustomers", next);
}

async function upsertSubscriptionForUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    status: SubscriptionStatus;
    productId: string | null;
    variantId: string | null;
    tier: SubscriptionTier | null;
    billingMode: BillingMode | null;
    durationDays: number | null;
    now: number;
  },
): Promise<{
  status: SubscriptionStatus;
  productId: string | null;
  variantId: string | null;
  tier: SubscriptionTier | null;
  billingMode: BillingMode | null;
  endsAt: number | null;
}> {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .first();

  const resolvedTier = args.tier ?? existing?.tier ?? null;
  const resolvedBillingMode = args.billingMode ?? existing?.billingMode ?? null;
  const resolvedProductId = args.productId ?? existing?.productId ?? null;
  const resolvedVariantId = args.variantId ?? existing?.variantId ?? null;

  let startedAt: number | undefined = existing?.startedAt;
  let endsAt: number | undefined = existing?.endsAt;

  if (args.status === "active") {
    if (resolvedBillingMode === "fixed_term") {
      if (!Number.isFinite(args.durationDays) || !args.durationDays || args.durationDays <= 0) {
        throw new Error("duration_days_invalid");
      }
      const durationMs = args.durationDays * 24 * 60 * 60 * 1000;
      const canExtend =
        existing?.status === "active" &&
        existing.billingMode === "fixed_term" &&
        existing.tier === resolvedTier &&
        existing.productId === resolvedProductId &&
        Number.isFinite(existing.endsAt) &&
        (existing.endsAt ?? 0) > args.now;
      const base = canExtend ? (existing!.endsAt as number) : args.now;
      startedAt = canExtend ? existing?.startedAt ?? args.now : args.now;
      endsAt = base + durationMs;
    } else {
      startedAt = args.now;
      endsAt = undefined;
    }
  } else if (resolvedBillingMode === "fixed_term") {
    endsAt = args.now;
  } else {
    endsAt = undefined;
  }

  const next = {
    status: args.status,
    tier: resolvedTier ?? undefined,
    billingMode: resolvedBillingMode ?? undefined,
    productId: resolvedProductId ?? undefined,
    variantId: resolvedVariantId ?? undefined,
    startedAt: startedAt ?? undefined,
    endsAt: endsAt ?? undefined,
    source: PROVIDER,
    updatedAt: args.now,
  };

  if (!existing) {
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      ...next,
    });
  } else {
    await ctx.db.patch(existing._id, next);
  }

  return {
    status: args.status,
    productId: resolvedProductId,
    variantId: resolvedVariantId,
    tier: resolvedTier,
    billingMode: resolvedBillingMode,
    endsAt: endsAt ?? null,
  };
}

async function listActiveDiscordLinksForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Array<Doc<"discordLinks">>> {
  const rows = await ctx.db
    .query("discordLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return rows.filter((row) => row.unlinkedAt === undefined);
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
    const projected = projectSellWebhookPayload(args.payload, args.eventId);
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
      eventType: projected.eventType || args.eventType,
      payload: args.payload,
      payloadHash: args.payloadHash,
      customerEmail: projected.customerEmail ?? undefined,
      externalCustomerId: projected.externalCustomerId ?? undefined,
      externalSubscriptionId: projected.externalSubscriptionId ?? undefined,
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
      return {
        ok: false as const,
        errorCode: "webhook_event_not_found",
        error: "webhook_event_not_found",
        deduped: false,
        subscriptionStatus: "inactive" as SubscriptionStatus,
        userId: null as Id<"users"> | null,
      };
    }

    if (event.status === "processed") {
      const projected = projectSellWebhookPayload(event.payload, event.eventId);
      return {
        ok: true as const,
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

    const projected = projectSellWebhookPayload(event.payload, event.eventId);

    try {
      const accessPolicy = await resolveEnabledSellAccessPolicy(ctx, {
        productId: projected.productId,
        variantId: projected.variantId,
      });

      const resolvedUser = await resolveUserFromPaymentTracking(ctx, {
        externalCustomerId: projected.externalCustomerId,
        externalSubscriptionId: projected.externalSubscriptionId,
        customerEmail: projected.customerEmail,
      });
      if (!resolvedUser) {
        throw new Error(
          `user_not_found:customer=${projected.externalCustomerId ?? "none"} subscription=${projected.externalSubscriptionId ?? "none"} email=${projected.customerEmail ?? "none"}`,
        );
      }

      if (projected.subscriptionStatus === "active" && !accessPolicy) {
        throw new Error(
          `sell_access_policy_missing:product=${projected.productId ?? "none"} variant=${projected.variantId ?? "none"}`,
        );
      }

      const subscription = await upsertSubscriptionForUser(ctx, {
        userId: resolvedUser.id,
        status: projected.subscriptionStatus,
        productId: projected.productId,
        variantId: projected.variantId,
        tier: accessPolicy?.tier ?? null,
        billingMode: accessPolicy?.billingMode ?? null,
        durationDays: accessPolicy?.durationDays ?? null,
        now: args.attemptedAt,
      });

      const activeLinks = await listActiveDiscordLinksForUser(
        ctx,
        resolvedUser.id,
      );
      for (const link of activeLinks) {
        const enqueueResult = await enqueueRoleSyncJobsForSubscription(ctx, {
          userId: resolvedUser.id,
          discordUserId: link.discordUserId,
          subscriptionStatus: projected.subscriptionStatus,
          tier: subscription.tier,
          source: `payment_${projected.eventType}`,
          now: args.attemptedAt,
        });

        if (enqueueResult.mappingSource === "none") {
          console.warn(
            `[payments] role sync queue not configured; skipped enqueue user=${resolvedUser.id} discord_user=${link.discordUserId} status=${projected.subscriptionStatus}`,
          );
        } else {
          console.info(
            `[payments] role sync enqueue user=${resolvedUser.id} discord_user=${link.discordUserId} status=${projected.subscriptionStatus} tier=${subscription.tier ?? "none"} mapped_tier=${enqueueResult.mappedTier ?? "none"} source=${enqueueResult.mappingSource} granted=${enqueueResult.granted} revoked=${enqueueResult.revoked} deduped=${enqueueResult.deduped} skipped=${enqueueResult.skipped}`,
          );
        }
      }

      await upsertPaymentCustomerTracking(ctx, {
        userId: resolvedUser.id,
        eventId: args.eventId,
        externalCustomerId: projected.externalCustomerId,
        externalSubscriptionId: projected.externalSubscriptionId,
        customerEmail: projected.customerEmail,
        now: args.attemptedAt,
      });

      await ctx.db.patch(event._id, {
        eventType: projected.eventType,
        customerEmail: projected.customerEmail ?? undefined,
        externalCustomerId: projected.externalCustomerId ?? undefined,
        externalSubscriptionId: projected.externalSubscriptionId ?? undefined,
        resolvedUserId: resolvedUser.id,
        resolvedVia: resolvedUser.method,
        status: "processed",
        processedAt: args.attemptedAt,
        lastAttemptAt: args.attemptedAt,
        error: undefined,
      });

      console.info(
        `[payments] processed webhook provider=${args.provider} event=${args.eventId} user=${resolvedUser.email ?? "unknown"} status=${projected.subscriptionStatus} tier=${subscription.tier ?? "none"} billing=${subscription.billingMode ?? "none"} ends_at=${subscription.endsAt ?? 0} attempts=${nextAttempt} resolvedVia=${resolvedUser.method} customer=${projected.externalCustomerId ?? "none"} subscription=${projected.externalSubscriptionId ?? "none"}`,
      );

      return {
        ok: true as const,
        deduped: false,
        subscriptionStatus: projected.subscriptionStatus,
        userId: resolvedUser.id,
      };
    } catch (error) {
      const message = getErrorMessage(error);

      await ctx.db.patch(event._id, {
        customerEmail: projected.customerEmail ?? undefined,
        externalCustomerId: projected.externalCustomerId ?? undefined,
        externalSubscriptionId: projected.externalSubscriptionId ?? undefined,
        status: "failed",
        error: message,
        lastAttemptAt: args.attemptedAt,
      });

      console.error(
        `[payments] failed webhook provider=${args.provider} event=${args.eventId} attempts=${nextAttempt} error=${message}`,
      );

      return {
        ok: false as const,
        errorCode: "processing_failed",
        error: message,
        deduped: false,
        subscriptionStatus: "inactive" as SubscriptionStatus,
        userId: null as Id<"users"> | null,
      };
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
      customerEmail: event.customerEmail ?? null,
      externalCustomerId: event.externalCustomerId ?? null,
      externalSubscriptionId: event.externalSubscriptionId ?? null,
      receivedAt: event.receivedAt,
      lastAttemptAt: event.lastAttemptAt ?? null,
      attemptCount: event.attemptCount ?? 0,
      error: event.error ?? null,
    }));
  },
});

export const expireFixedTermSubscriptions = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.max(1, Math.min(500, args.limit ?? 100));

    const candidates = await ctx.db
      .query("subscriptions")
      .withIndex("by_status_endsAt", (q) =>
        q.eq("status", "active").lte("endsAt", now),
      )
      .take(limit);

    let expired = 0;
    let roleSyncQueued = 0;

    for (const subscription of candidates) {
      if (subscription.billingMode !== "fixed_term") continue;
      if (!subscription.endsAt || subscription.endsAt > now) continue;

      await ctx.db.patch(subscription._id, {
        status: "inactive",
        updatedAt: now,
      });
      expired += 1;

      const activeLinks = await listActiveDiscordLinksForUser(
        ctx,
        subscription.userId,
      );
      for (const link of activeLinks) {
        const enqueueResult = await enqueueRoleSyncJobsForSubscription(ctx, {
          userId: subscription.userId,
          discordUserId: link.discordUserId,
          subscriptionStatus: "inactive",
          tier: subscription.tier ?? null,
          source: "subscription_expired_fixed_term",
          now,
        });
        roleSyncQueued += enqueueResult.granted + enqueueResult.revoked;
      }
    }

    if (expired > 0) {
      console.info(
        `[payments] fixed-term expiry run expired=${expired} role_sync_jobs=${roleSyncQueued} now=${now}`,
      );
    }

    return { expired, roleSyncQueued };
  },
});

export const listPaymentCustomers = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, args.limit ?? 50));
    const search = (args.search ?? "").trim().toLowerCase();

    const rows = await ctx.db.query("paymentCustomers").collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);

    const filtered = search
      ? rows.filter((row) => {
          const haystack = [
            row.provider,
            row.customerEmail ?? "",
            row.externalCustomerId ?? "",
            row.externalSubscriptionId ?? "",
            row.lastEventId ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(search);
        })
      : rows;

    const slice = filtered.slice(0, limit);
    const result: Array<{
      provider: string;
      userId: Id<"users">;
      userEmail: string | null;
      tier: SubscriptionTier | null;
      billingMode: BillingMode | null;
      subscriptionStatus: SubscriptionStatus | null;
      endsAt: number | null;
      customerEmail: string | null;
      externalCustomerId: string | null;
      externalSubscriptionId: string | null;
      lastEventId: string | null;
      updatedAt: number;
    }> = [];

    for (const row of slice) {
      const user = await ctx.db.get(row.userId);
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", row.userId))
        .first();

      result.push({
        provider: row.provider,
        userId: row.userId,
        userEmail: user && typeof user.email === "string" ? user.email : null,
        tier: subscription?.tier ?? null,
        billingMode: subscription?.billingMode ?? null,
        subscriptionStatus: subscription?.status ?? null,
        endsAt: subscription?.endsAt ?? null,
        customerEmail: row.customerEmail ?? null,
        externalCustomerId: row.externalCustomerId ?? null,
        externalSubscriptionId: row.externalSubscriptionId ?? null,
        lastEventId: row.lastEventId ?? null,
        updatedAt: row.updatedAt,
      });
    }

    console.info(
      `[payments] operator listPaymentCustomers search=${search || "none"} returned=${result.length}`,
    );

    return result;
  },
});
