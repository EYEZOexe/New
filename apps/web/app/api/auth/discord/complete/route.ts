import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getAuthContext } from "../../../../../lib/auth";
import { getAppwritePublicConfig, getAppwriteServerConfig } from "../../../../../lib/appwrite-server";
import { createAppwriteAdminRestClient } from "../../../../../lib/appwrite-admin-rest";
import { createAppwriteSessionRestClient, createTokenSessionCookieValue } from "../../../../../lib/appwrite-session-rest";
import { pickDiscordIdentity, validateDiscordOAuthComplete } from "../../../../../lib/discord-oauth";
import { buildRoleSyncJobDoc } from "../../../../../lib/role-sync-jobs";
import { getExternalOriginFromHeaders } from "../../../../../lib/external-request";

const STATE_COOKIE = "discord_oauth_state";

function redirectToDashboard(origin: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return NextResponse.redirect(new URL(`/dashboard${suffix}`, origin));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const tokenUserId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");

  const h = await headers();
  const ext = getExternalOriginFromHeaders(h as any, process.env.NODE_ENV);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? null;

  // Always clear the state cookie (single-use).
  const clearStateCookie = true;

  const auth = await getAuthContext();
  if (!auth) {
    const res = redirectToDashboard(ext.origin, { discord: "unauthorized" });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!tokenUserId || !secret) {
    const res = redirectToDashboard(ext.origin, { discord: "missing_token" });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const validation = validateDiscordOAuthComplete({
    expectedState,
    actualState: state,
    currentUserId: auth.userId,
    tokenUserId
  });
  if (!validation.ok) {
    const res = redirectToDashboard(ext.origin, { discord: validation.error });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const publicCfg = getAppwritePublicConfig();
  const serverCfg = getAppwriteServerConfig();

  // Exchange the Appwrite OAuth token for a refreshed session cookie value.
  let newSessionToken: string;
  try {
    newSessionToken = await createTokenSessionCookieValue({
      endpoint: publicCfg.endpoint,
      projectId: publicCfg.projectId,
      userId: tokenUserId,
      secret
    });
  } catch {
    const res = redirectToDashboard(ext.origin, { discord: "token_exchange_failed" });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  // Compute cookie domain the same way login/signup do.
  const hostHeader = h.get("host") ?? "";
  const host = hostHeader.startsWith("[") ? hostHeader : hostHeader.split(":")[0];
  const cookieDomain =
    publicCfg.cookieDomain && host.endsWith(publicCfg.cookieDomain.replace(/^\./, ""))
      ? publicCfg.cookieDomain
      : undefined;

  // Use the refreshed session to read identities.
  const session = createAppwriteSessionRestClient({
    endpoint: publicCfg.endpoint,
    projectId: publicCfg.projectId,
    sessionToken: newSessionToken
  });

  let discordUserId: string | null = null;
  try {
    const identities = await session.listIdentities();
    discordUserId = pickDiscordIdentity(identities);
  } catch {
    discordUserId = null;
  }

  if (!discordUserId) {
    const res = redirectToDashboard(ext.origin, { discord: "identity_missing" });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  // Persist linkage to profiles (admin key).
  const databaseId = process.env.APPWRITE_DATABASE_ID ?? "crypto";
  const profilesCollectionId = process.env.APPWRITE_PROFILES_COLLECTION_ID ?? "profiles";

  const adminDb = createAppwriteAdminRestClient({
    endpoint: serverCfg.endpoint,
    projectId: serverCfg.projectId,
    apiKey: serverCfg.apiKey
  });

  await adminDb.upsertDocumentPut({
    databaseId,
    collectionId: profilesCollectionId,
    documentId: auth.userId,
    data: {
      userId: auth.userId,
      discordUserId,
      discordLinkedAt: new Date().toISOString()
    }
  });

  // Enqueue role sync job (best-effort; linking should still succeed if mapping isn't set up yet).
  try {
    const subscriptionsCollectionId = process.env.APPWRITE_SUBSCRIPTIONS_COLLECTION_ID ?? "subscriptions";
    const roleMappingsCollectionId =
      process.env.APPWRITE_DISCORD_ROLE_MAPPINGS_COLLECTION_ID ?? "discord_role_mappings";
    const roleSyncJobsCollectionId = process.env.APPWRITE_ROLE_SYNC_JOBS_COLLECTION_ID ?? "role_sync_jobs";
    const customerGuildId = process.env.CUSTOMER_GUILD_ID ?? "";

    let subscriptionStatus: string | null = null;
    let plan: string | null = null;
    try {
      const sub = await adminDb.getDocument({
        databaseId,
        collectionId: subscriptionsCollectionId,
        documentId: auth.userId
      });
      subscriptionStatus = typeof sub?.status === "string" ? sub.status : null;
      plan = typeof sub?.plan === "string" ? sub.plan : null;
    } catch {
      // missing subscription is treated as inactive/no plan
      subscriptionStatus = null;
      plan = null;
    }

    const mappingsRes = await adminDb.listDocuments({
      databaseId,
      collectionId: roleMappingsCollectionId,
      limit: 100
    });
    const mappingDocs = Array.isArray(mappingsRes?.documents) ? mappingsRes.documents : [];
    const filteredMappings = customerGuildId
      ? mappingDocs.filter((d: any) => d?.guildId === customerGuildId)
      : mappingDocs;

    const jobDoc = buildRoleSyncJobDoc({
      userId: auth.userId,
      discordUserId,
      guildId: customerGuildId,
      subscriptionStatus,
      plan,
      mappingDocs: filteredMappings
    });

    await adminDb.upsertDocumentPut({
      databaseId,
      collectionId: roleSyncJobsCollectionId,
      documentId: auth.userId,
      data: jobDoc
    });
  } catch {
    // ignore
  }

  const res = redirectToDashboard(ext.origin, { discord: "linked" });
  res.cookies.set(publicCfg.sessionCookieName, newSessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {})
  });
  if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
  res.headers.set("cache-control", "no-store");
  return res;
}
