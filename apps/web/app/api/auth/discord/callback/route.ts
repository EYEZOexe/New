import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getAuthContext } from "../../../../../lib/auth";
import { getAppwriteServerConfig } from "../../../../../lib/appwrite-server";
import { createAppwriteAdminRestClient } from "../../../../../lib/appwrite-admin-rest";
import { verifyOAuthState } from "../../../../../lib/discord-linking";
import { getExternalOriginFromHeaders } from "../../../../../lib/external-request";
import { exchangeDiscordCodeForToken, getDiscordUser } from "../../../../../lib/discord-oauth-client";
import { buildRoleSyncJobDoc } from "../../../../../lib/role-sync-jobs";

const STATE_COOKIE = "discord_oauth_state";

function redirectToDashboard(origin: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return NextResponse.redirect(new URL(`/dashboard${suffix}`, origin));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  const h = await headers();
  const ext = getExternalOriginFromHeaders(h as any, process.env.NODE_ENV);

  const auth = await getAuthContext();
  if (!auth) return redirectToDashboard(ext.origin, { discord: "unauthorized" });

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? "";

  // Always clear the state cookie (single-use).
  const clearStateCookie = true;

  if (errParam) {
    const res = redirectToDashboard(ext.origin, { discord: "link_failed", error: errParam });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!code || !state || !verifyOAuthState(expectedState, state)) {
    const res = redirectToDashboard(ext.origin, { discord: "invalid_state" });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const redirectUri = new URL("/api/auth/discord/callback", ext.origin).toString();

  let discordUserId: string;
  try {
    const token = await exchangeDiscordCodeForToken({ code, redirectUri });
    const user = await getDiscordUser(token.access_token);
    discordUserId = user.id;
  } catch (e: any) {
    // Surface a short code; details go to server logs.
    console.error("[discord-oauth-callback] exchange failed", {
      message: e?.message ?? String(e),
      code: e?.code ?? null,
      response: e?.response ?? null
    });
    const res = redirectToDashboard(ext.origin, { discord: "link_failed", error: "oauth_exchange_failed" });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

  // Persist linkage to profiles + enqueue job (admin key).
  const serverCfg = getAppwriteServerConfig();
  const adminDb = createAppwriteAdminRestClient({
    endpoint: serverCfg.endpoint,
    projectId: serverCfg.projectId,
    apiKey: serverCfg.apiKey
  });

  const databaseId = process.env.APPWRITE_DATABASE_ID ?? "crypto";
  const profilesCollectionId = process.env.APPWRITE_PROFILES_COLLECTION_ID ?? "profiles";

  try {
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
  } catch (e: any) {
    console.error("[discord-oauth-callback] profile upsert failed", {
      message: e?.message ?? String(e),
      code: e?.code ?? null,
      response: e?.response ?? null
    });
    const res = redirectToDashboard(ext.origin, { discord: "link_failed", error: "profile_write_failed" });
    if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
    return res;
  }

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

    const missingGuildId = !customerGuildId;
    const jobDoc = buildRoleSyncJobDoc({
      userId: auth.userId,
      discordUserId,
      guildId: customerGuildId,
      subscriptionStatus,
      plan,
      mappingDocs: filteredMappings,
      ...(missingGuildId
        ? {
            statusOverride: "failed" as const,
            lastError: "missing_customer_guild_id"
          }
        : {})
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
  if (clearStateCookie) res.cookies.delete(STATE_COOKIE);
  res.headers.set("cache-control", "no-store");
  return res;
}
