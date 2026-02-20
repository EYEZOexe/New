import {
  invalidateSessions,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  normalizeEmail,
  projectSellWebhookPayload,
  type SubscriptionStatus,
} from "./paymentsUtils";
import {
  resolveEnabledSellAccessPolicy,
  type SubscriptionTier,
} from "./sellAccessPolicies";
import {
  enqueueRoleSyncJobsForSubscription,
} from "./roleSyncQueue";

const PROVIDER = "sellapp";
const PASSWORD_PROVIDER = "password";
type UserResolutionMethod =
  | "payment_subscription_id"
  | "payment_customer_id"
  | "email";
type OperatorResult<T extends Record<string, unknown>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function asOperatorError(error: unknown): { code: string; message: string } {
  const raw = getErrorMessage(error).trim();
  switch (raw) {
    case "user_not_found":
      return { code: raw, message: "User not found." };
    case "email_invalid":
      return { code: raw, message: "A valid email address is required." };
    case "email_in_use":
      return {
        code: raw,
        message: "That email is already used by another account.",
      };
    case "password_invalid":
      return {
        code: raw,
        message: "Password must be at least 8 characters long.",
      };
    case "password_account_not_found":
      return {
        code: raw,
        message: "No password account exists for this user.",
      };
    case "duration_days_invalid":
      return {
        code: raw,
        message: "Duration days must be a positive integer.",
      };
    default:
      return {
        code: "operator_action_failed",
        message: raw || "Operator action failed.",
      };
  }
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRequiredDurationDays(raw: number | undefined): number {
  const parsed = Math.floor(raw ?? 14);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("duration_days_invalid");
  }
  return parsed;
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
    durationDays: number | null;
    now: number;
  },
): Promise<{
  status: SubscriptionStatus;
  productId: string | null;
  variantId: string | null;
  tier: SubscriptionTier | null;
  endsAt: number | null;
}> {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .first();

  const resolvedTier = args.tier ?? existing?.tier ?? null;
  const resolvedProductId = args.productId ?? existing?.productId ?? null;
  const resolvedVariantId = args.variantId ?? existing?.variantId ?? null;

  let startedAt: number | undefined = existing?.startedAt;
  let endsAt: number | undefined = existing?.endsAt;

  if (args.status === "active") {
    if (!Number.isFinite(args.durationDays) || !args.durationDays || args.durationDays <= 0) {
      throw new Error("duration_days_invalid");
    }
    const durationMs = args.durationDays * 24 * 60 * 60 * 1000;
    const canExtend =
      existing?.status === "active" &&
      existing.tier === resolvedTier &&
      existing.productId === resolvedProductId &&
      Number.isFinite(existing.endsAt) &&
      (existing.endsAt ?? 0) > args.now;
    const base = canExtend ? (existing!.endsAt as number) : args.now;
    startedAt = canExtend ? existing?.startedAt ?? args.now : args.now;
    endsAt = base + durationMs;
  } else {
    endsAt = args.now;
  }

  const next = {
    status: args.status,
    tier: resolvedTier ?? undefined,
    billingMode: "fixed_term" as const,
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
        `[payments] processed webhook provider=${args.provider} event=${args.eventId} user=${resolvedUser.email ?? "unknown"} status=${projected.subscriptionStatus} tier=${subscription.tier ?? "none"} ends_at=${subscription.endsAt ?? 0} attempts=${nextAttempt} resolvedVia=${resolvedUser.method} customer=${projected.externalCustomerId ?? "none"} subscription=${projected.externalSubscriptionId ?? "none"}`,
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

export const adminUpdatePaymentCustomerEmail = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<OperatorResult<{ userId: Id<"users">; email: string }>> => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("user_not_found");
      }

      const normalizedEmail = normalizeEmail(args.email);
      if (!normalizedEmail || !isValidEmailAddress(normalizedEmail)) {
        throw new Error("email_invalid");
      }

      const users = await ctx.db.query("users").collect();
      const existingUser = users.find(
        (row) =>
          normalizeEmail(typeof row.email === "string" ? row.email : null) === normalizedEmail &&
          row._id !== args.userId,
      );
      if (existingUser) {
        throw new Error("email_in_use");
      }

      const passwordAccount = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", args.userId).eq("provider", PASSWORD_PROVIDER),
        )
        .first();
      if (passwordAccount) {
        const allPasswordAccounts = await ctx.db.query("authAccounts").collect();
        const conflictingAccount = allPasswordAccounts.find(
          (account) =>
            account.provider === PASSWORD_PROVIDER &&
            normalizeEmail(account.providerAccountId) === normalizedEmail &&
            account._id !== passwordAccount._id,
        );
        if (conflictingAccount) {
          throw new Error("email_in_use");
        }

        await ctx.db.patch(passwordAccount._id, {
          providerAccountId: normalizedEmail,
        });
      }

      await ctx.db.patch(args.userId, {
        email: normalizedEmail,
      });

      const trackingRows = await ctx.db
        .query("paymentCustomers")
        .withIndex("by_provider_userId", (q) =>
          q.eq("provider", PROVIDER).eq("userId", args.userId),
        )
        .collect();
      const now = Date.now();
      for (const row of trackingRows) {
        await ctx.db.patch(row._id, {
          customerEmail: normalizedEmail,
          updatedAt: now,
        });
      }

      console.info(
        `[payments] operator updated customer email user=${args.userId} email=${normalizedEmail} payment_rows=${trackingRows.length}`,
      );

      return {
        ok: true,
        userId: args.userId,
        email: normalizedEmail,
      };
    } catch (error) {
      const shaped = asOperatorError(error);
      console.error(
        `[payments] operator update email failed user=${args.userId} code=${shaped.code} message=${shaped.message}`,
      );
      return {
        ok: false,
        error: shaped,
      };
    }
  },
});

export const adminSetPaymentCustomerPassword = action({
  args: {
    userId: v.id("users"),
    password: v.string(),
    invalidateExistingSessions: v.optional(v.boolean()),
  },
  handler: async (
    ctx: ActionCtx,
    args,
  ): Promise<OperatorResult<{ userId: Id<"users">; sessionsInvalidated: boolean }>> => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("user_not_found");
      }

      const password = args.password.trim();
      if (!password || password.length < 8) {
        throw new Error("password_invalid");
      }

      const passwordAccount = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", args.userId).eq("provider", PASSWORD_PROVIDER),
        )
        .first();
      if (!passwordAccount) {
        throw new Error("password_account_not_found");
      }

      await modifyAccountCredentials(ctx, {
        provider: PASSWORD_PROVIDER,
        account: {
          id: passwordAccount.providerAccountId,
          secret: password,
        },
      });

      const sessionsInvalidated = args.invalidateExistingSessions ?? true;
      if (sessionsInvalidated) {
        await invalidateSessions(ctx, {
          userId: args.userId,
        });
      }

      console.info(
        `[payments] operator reset password user=${args.userId} sessions_invalidated=${sessionsInvalidated}`,
      );

      return {
        ok: true,
        userId: args.userId,
        sessionsInvalidated,
      };
    } catch (error) {
      const shaped = asOperatorError(error);
      console.error(
        `[payments] operator reset password failed user=${args.userId} code=${shaped.code} message=${shaped.message}`,
      );
      return {
        ok: false,
        error: shaped,
      };
    }
  },
});

export const adminSetPaymentCustomerSubscription = mutation({
  args: {
    userId: v.id("users"),
    action: v.union(v.literal("grant"), v.literal("revoke")),
    tier: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"), v.literal("pro")),
    ),
    durationDays: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    OperatorResult<{
      userId: Id<"users">;
      subscriptionStatus: SubscriptionStatus;
      tier: SubscriptionTier | null;
      endsAt: number | null;
      roleSyncQueued: number;
    }>
  > => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("user_not_found");
      }

      const now = Date.now();
      const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();

      let nextStatus: SubscriptionStatus = "inactive";
      let nextTier: SubscriptionTier | null = existing?.tier ?? null;
      let nextEndsAt: number | null = existing?.endsAt ?? null;

      if (args.action === "grant") {
        const tier = args.tier ?? existing?.tier ?? "basic";
        const durationDays = normalizeRequiredDurationDays(args.durationDays);
        const durationMs = durationDays * 24 * 60 * 60 * 1000;
        const canExtend =
          existing?.status === "active" &&
          existing.tier === tier &&
          Number.isFinite(existing.endsAt) &&
          (existing.endsAt ?? 0) > now;
        const base = canExtend ? (existing!.endsAt as number) : now;
        const startedAt = canExtend ? (existing?.startedAt ?? now) : now;
        const endsAt = base + durationMs;
        nextStatus = "active";
        nextTier = tier;
        nextEndsAt = endsAt;

        if (existing) {
          await ctx.db.patch(existing._id, {
            status: nextStatus,
            tier,
            billingMode: "fixed_term",
            startedAt,
            endsAt,
            source: "admin_manual_grant",
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("subscriptions", {
            userId: args.userId,
            status: nextStatus,
            tier,
            billingMode: "fixed_term",
            startedAt,
            endsAt,
            source: "admin_manual_grant",
            updatedAt: now,
          });
        }
      } else {
        nextStatus = "inactive";
        nextTier = existing?.tier ?? args.tier ?? null;
        nextEndsAt = now;

        if (existing) {
          await ctx.db.patch(existing._id, {
            status: nextStatus,
            endsAt: now,
            source: "admin_manual_revoke",
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("subscriptions", {
            userId: args.userId,
            status: nextStatus,
            tier: nextTier ?? undefined,
            billingMode: "fixed_term",
            endsAt: now,
            source: "admin_manual_revoke",
            updatedAt: now,
          });
        }
      }

      let roleSyncQueued = 0;
      const activeLinks = await listActiveDiscordLinksForUser(ctx, args.userId);
      for (const link of activeLinks) {
        const enqueueResult = await enqueueRoleSyncJobsForSubscription(ctx, {
          userId: args.userId,
          discordUserId: link.discordUserId,
          subscriptionStatus: nextStatus,
          tier: nextTier,
          source:
            args.action === "grant"
              ? "admin_manual_subscription_grant"
              : "admin_manual_subscription_revoke",
          now,
        });
        roleSyncQueued += enqueueResult.granted + enqueueResult.revoked;
      }

      console.info(
        `[payments] operator subscription update user=${args.userId} action=${args.action} status=${nextStatus} tier=${nextTier ?? "none"} ends_at=${nextEndsAt ?? 0} role_sync_jobs=${roleSyncQueued}`,
      );

      return {
        ok: true,
        userId: args.userId,
        subscriptionStatus: nextStatus,
        tier: nextTier,
        endsAt: nextEndsAt,
        roleSyncQueued,
      };
    } catch (error) {
      const shaped = asOperatorError(error);
      console.error(
        `[payments] operator subscription update failed user=${args.userId} action=${args.action} code=${shaped.code} message=${shaped.message}`,
      );
      return {
        ok: false,
        error: shaped,
      };
    }
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
            row.userId,
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
