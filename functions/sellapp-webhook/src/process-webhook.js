import { createAppwriteRestClient } from "./appwrite-rest.js";
import { mapSellappEventToAction, pickEmail, sha256Hex, verifySellappSignature } from "./sellapp.js";

function requiredEnv(env, name) {
  const value = env?.[name];
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

function normalizeHeader(headers, name) {
  const key = name.toLowerCase();
  return headers?.[key] ?? headers?.[name] ?? null;
}

async function ensureWebhookEventOnce({
  appwrite,
  databaseId,
  webhookEventsCollectionId,
  eventId,
  provider,
  orderId,
  payloadHash,
  processedAt
}) {
  const documentId = sha256Hex(eventId).slice(0, 36);
  try {
    await appwrite.createDocument({
      databaseId,
      collectionId: webhookEventsCollectionId,
      documentId,
      data: {
        provider,
        eventId,
        orderId: orderId ?? null,
        payloadHash: payloadHash ?? null,
        processedAt: processedAt ?? null
      }
    });
    return { firstTime: true };
  } catch (err) {
    if (err?.status === 409) return { firstTime: false };
    throw err;
  }
}

async function getUserByEmail({ appwrite, email }) {
  const list = await appwrite.listUsers({ search: email });
  const users = Array.isArray(list?.users) ? list.users : [];
  return users.find((u) => (u?.email || "").toLowerCase() === email) ?? null;
}

async function upsertSubscription({
  appwrite,
  databaseId,
  subscriptionsCollectionId,
  userId,
  status,
  plan,
  sellappOrderId,
  currentPeriodEnd
}) {
  const data = {
    userId,
    status,
    plan: plan ?? null,
    sellappOrderId: sellappOrderId ?? null,
    currentPeriodEnd: currentPeriodEnd ?? null
  };

  try {
    await appwrite.createDocument({
      databaseId,
      collectionId: subscriptionsCollectionId,
      documentId: userId,
      data
    });
    return { created: true };
  } catch (err) {
    if (err?.status !== 409) throw err;
    await appwrite.updateDocument({
      databaseId,
      collectionId: subscriptionsCollectionId,
      documentId: userId,
      data
    });
    return { created: false };
  }
}

async function ensurePaidTeamMembership({ appwrite, teamPaidId, user, action, appBaseUrl }) {
  if (!teamPaidId) return { changed: false, skipped: true };

  const memberships = await appwrite.listMemberships({ teamId: teamPaidId });
  const list = Array.isArray(memberships?.memberships) ? memberships.memberships : [];
  const existing = list.find((m) => m?.userId === user.$id) ?? null;

  if (action === "grant") {
    if (existing) return { changed: false, skipped: false };
    await appwrite.createMembership({
      teamId: teamPaidId,
      roles: ["member"],
      userId: user.$id,
      name: user.name ?? undefined,
      url: appBaseUrl ?? undefined
    });
    return { changed: true, skipped: false };
  }

  if (action === "revoke") {
    if (!existing) return { changed: false, skipped: false };
    await appwrite.deleteMembership({ teamId: teamPaidId, membershipId: existing.$id });
    return { changed: true, skipped: false };
  }

  return { changed: false, skipped: true };
}

export async function processSellappWebhook({ req, env, fetchImpl }) {
  if ((req?.method || "").toUpperCase() !== "POST") return { ok: true, message: "use POST" };

  const sellappSecret = requiredEnv(env, "SELLAPP_WEBHOOK_SECRET");

  const bodyText = req?.bodyText ?? "";
  const signatureHeader = normalizeHeader(req?.headers, "signature");
  const okSig = verifySellappSignature({
    secret: sellappSecret,
    bodyText,
    signatureHeader
  });
  if (!okSig) return { ok: false, error: "invalid_signature" };

  const payload = (req?.bodyJson && typeof req.bodyJson === "object" ? req.bodyJson : null) ?? safeJsonParse(bodyText);
  if (!payload) return { ok: false, error: "invalid_json" };

  const endpoint = requiredEnv(env, "APPWRITE_ENDPOINT");
  const projectId = requiredEnv(env, "APPWRITE_PROJECT_ID");
  const apiKey = requiredEnv(env, "APPWRITE_API_KEY");

  const databaseId = requiredEnv(env, "APPWRITE_DATABASE_ID");
  const subscriptionsCollectionId = requiredEnv(env, "APPWRITE_SUBSCRIPTIONS_COLLECTION_ID");
  const webhookEventsCollectionId = requiredEnv(env, "APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID");
  const teamPaidId = env?.APPWRITE_TEAM_PAID_ID || null;
  const appBaseUrl = env?.APP_BASE_URL || null;

  const appwrite = createAppwriteRestClient({ endpoint, projectId, apiKey, fetchImpl });

  const event = payload?.event ?? "unknown";
  const orderId = payload?.data?.id ?? payload?.data?.order?.id ?? null;
  const store = payload?.store ?? "no-store";
  const eventId = `${event}:${orderId ?? "no-order"}:${store}`;
  const payloadHash = sha256Hex(bodyText);

  const idempotency = await ensureWebhookEventOnce({
    appwrite,
    databaseId,
    webhookEventsCollectionId,
    eventId,
    provider: "sellapp",
    orderId: orderId ? String(orderId) : null,
    payloadHash,
    processedAt: new Date().toISOString()
  });

  if (!idempotency.firstTime) return { ok: true, duplicate: true };

  const email = pickEmail(payload);
  if (!email) return { ok: true, warning: "no_email_in_payload" };

  const user = await getUserByEmail({ appwrite, email });
  if (!user) return { ok: true, warning: "user_not_found" };

  const mapped = mapSellappEventToAction(event);
  if (!mapped.subscriptionStatus) return { ok: true, recorded: true, unhandledEvent: event };

  await upsertSubscription({
    appwrite,
    databaseId,
    subscriptionsCollectionId,
    userId: user.$id,
    status: mapped.subscriptionStatus,
    plan: payload?.data?.plan ?? payload?.data?.product ?? null,
    sellappOrderId: orderId ? String(orderId) : null,
    currentPeriodEnd: payload?.data?.currentPeriodEnd ?? payload?.data?.current_period_end ?? null
  });

  await ensurePaidTeamMembership({
    appwrite,
    teamPaidId,
    user,
    action: mapped.teamAction,
    appBaseUrl
  });

  return { ok: true };
}
