import crypto from "node:crypto";
import sdk from "node-appwrite";

/**
 * Sell.app webhook handler (Appwrite Function)
 *
 * Trigger: HTTP (Execute via domain)
 * Execute access: Any (webhook provider calls without Appwrite headers)
 *
 * Security:
 * - Verifies Sell.app HMAC signature from `signature` header
 * - Idempotent via `webhook_events.eventId` unique index
 *
 * Effects:
 * - Upserts a `subscriptions` document for the Appwrite user
 * - Adds/removes the user from `paid` team
 */

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqualHex(a, b) {
  // Both must be same length for timingSafeEqual.
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function normalizeHeader(headers, name) {
  // Appwrite lowercases header keys.
  const key = name.toLowerCase();
  return headers?.[key] ?? headers?.[name] ?? null;
}

function pickEmail(payload) {
  // We don't fully control Sell.app payload shape across versions.
  // Try a few common locations.
  const candidates = [
    payload?.data?.email,
    payload?.data?.customer?.email,
    payload?.data?.order?.email,
    payload?.data?.order?.customer_email,
    payload?.data?.billing?.email,
    payload?.customer?.email,
    payload?.order?.email
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c.trim().toLowerCase();
  }
  return null;
}

function mapSellappEventToStatus(event) {
  // Conservative mapping.
  // Expand as we confirm real Sell.app event types for refunds/cancellations.
  if (event === "order.completed") return { status: "active", action: "grant" };
  if (event === "order.disputed") return { status: "inactive", action: "revoke" };
  return { status: null, action: null };
}

async function ensureWebhookEventOnce({ databases, databaseId, webhookEventsCollectionId, eventId, provider, orderId, payloadHash, processedAt }) {
  const docId = sha256Hex(eventId).slice(0, 36);
  try {
    await databases.createDocument(databaseId, webhookEventsCollectionId, docId, {
      provider,
      eventId,
      orderId: orderId ?? null,
      payloadHash: payloadHash ?? null,
      processedAt: processedAt ?? null
    });
    return { firstTime: true };
  } catch (err) {
    // Unique index on eventId will throw conflict if already handled.
    if (err?.code === 409) return { firstTime: false };
    throw err;
  }
}

async function getUserByEmail({ users, email }) {
  const result = await users.list({
    queries: [sdk.Query.equal("email", email)],
    search: email
  });
  return result?.users?.find((u) => (u.email || "").toLowerCase() === email) ?? null;
}

async function upsertSubscription({ databases, databaseId, subscriptionsCollectionId, userId, status, plan, sellappOrderId, currentPeriodEnd }) {
  // Use userId as documentId for natural upsert.
  const data = {
    userId,
    status,
    plan: plan ?? null,
    sellappOrderId: sellappOrderId ?? null,
    currentPeriodEnd: currentPeriodEnd ?? null
  };

  try {
    await databases.createDocument(databaseId, subscriptionsCollectionId, userId, data);
    return { created: true };
  } catch (err) {
    if (err?.code !== 409) throw err;
    await databases.updateDocument(databaseId, subscriptionsCollectionId, userId, data);
    return { created: false };
  }
}

async function ensurePaidTeamMembership({ teams, teamPaidId, user, action }) {
  if (!teamPaidId) return { changed: false, skipped: true };
  const roles = ["member"];

  // For now team is small. List + filter client-side.
  const memberships = await teams.listMemberships(teamPaidId, {
    queries: [sdk.Query.limit(200)]
  });

  const existing = memberships?.memberships?.find((m) => m.userId === user.$id) ?? null;

  if (action === "grant") {
    if (existing) return { changed: false, skipped: false };
    await teams.createMembership({ teamId: teamPaidId, roles, userId: user.$id, name: user.name ?? undefined });
    return { changed: true, skipped: false };
  }

  if (action === "revoke") {
    if (!existing) return { changed: false, skipped: false };
    await teams.deleteMembership(teamPaidId, existing.$id);
    return { changed: true, skipped: false };
  }

  return { changed: false, skipped: true };
}

export default async ({ req, res, log, error }) => {
  try {
    if (req.method !== "POST") return res.json({ ok: true, message: "use POST" });

    const sellappSecret = requiredEnv("SELLAPP_WEBHOOK_SECRET");
    const appwriteEndpoint = requiredEnv("APPWRITE_ENDPOINT");
    const appwriteProjectId = requiredEnv("APPWRITE_PROJECT_ID");
    const appwriteApiKey = requiredEnv("APPWRITE_API_KEY");

    const databaseId = requiredEnv("APPWRITE_DATABASE_ID");
    const subscriptionsCollectionId = requiredEnv("APPWRITE_SUBSCRIPTIONS_COLLECTION_ID");
    const webhookEventsCollectionId = requiredEnv("APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID");
    const teamPaidId = process.env.APPWRITE_TEAM_PAID_ID || null;

    const signatureHeader = normalizeHeader(req.headers, "signature");
    const bodyText = req.bodyText ?? "";
    const computed = hmacSha256Hex(sellappSecret, bodyText);

    if (!timingSafeEqualHex(computed, signatureHeader)) {
      error("Invalid webhook signature");
      return res.json({ ok: false, error: "invalid_signature" });
    }

    const payload = req.bodyJson ?? safeJsonParse(bodyText);
    if (!payload) {
      return res.json({ ok: false, error: "invalid_json" });
    }

    const event = payload.event ?? "unknown";
    const orderId = payload?.data?.id ?? payload?.data?.order?.id ?? null;
    const eventId = `${event}:${orderId ?? "no-order"}:${payload?.store ?? "no-store"}`;
    const payloadHash = sha256Hex(bodyText);

    const client = new sdk.Client()
      .setEndpoint(appwriteEndpoint)
      .setProject(appwriteProjectId)
      .setKey(appwriteApiKey);

    const databases = new sdk.Databases(client);
    const users = new sdk.Users(client);
    const teams = new sdk.Teams(client);

    // Idempotency guard
    const idempotency = await ensureWebhookEventOnce({
      databases,
      databaseId,
      webhookEventsCollectionId,
      eventId,
      provider: "sellapp",
      orderId: orderId ? String(orderId) : null,
      payloadHash,
      processedAt: new Date().toISOString()
    });

    if (!idempotency.firstTime) {
      log(`Duplicate webhook ignored: ${eventId}`);
      return res.json({ ok: true, duplicate: true });
    }

    const email = pickEmail(payload);
    if (!email) {
      // We still recorded webhook event for later manual inspection.
      error(`No email found in payload for ${eventId}`);
      return res.json({ ok: true, warning: "no_email_in_payload" });
    }

    const user = await getUserByEmail({ users, email });
    if (!user) {
      error(`No Appwrite user found for email=${email}`);
      return res.json({ ok: true, warning: "user_not_found" });
    }

    const mapped = mapSellappEventToStatus(event);
    if (!mapped.status) {
      log(`Unhandled sell.app event '${event}', recorded only.`);
      return res.json({ ok: true, recorded: true, unhandledEvent: event });
    }

    // Update subscription record
    await upsertSubscription({
      databases,
      databaseId,
      subscriptionsCollectionId,
      userId: user.$id,
      status: mapped.status,
      plan: payload?.data?.plan ?? payload?.data?.product ?? null,
      sellappOrderId: orderId ? String(orderId) : null,
      currentPeriodEnd: payload?.data?.currentPeriodEnd ?? payload?.data?.current_period_end ?? null
    });

    // Team gating
    await ensurePaidTeamMembership({ teams, teamPaidId, user, action: mapped.action });

    return res.json({ ok: true });
  } catch (err) {
    error(err?.message ?? String(err));
    // Don't leak details to webhook caller.
    return res.json({ ok: false, error: "internal_error" });
  }
};
