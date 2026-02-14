import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthContext } from "../../../../../lib/auth";
import { getAppwritePublicConfig, getAppwriteServerConfig } from "../../../../../lib/appwrite-server";
import { createAppwriteAdminRestClient } from "../../../../../lib/appwrite-admin-rest";
import { createAppwriteSessionRestClient } from "../../../../../lib/appwrite-session-rest";
import { buildRoleSyncJobDoc } from "../../../../../lib/role-sync-jobs";

export async function POST() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const publicCfg = getAppwritePublicConfig();
  const serverCfg = getAppwriteServerConfig();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(publicCfg.sessionCookieName)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = createAppwriteSessionRestClient({
    endpoint: publicCfg.endpoint,
    projectId: publicCfg.projectId,
    sessionToken
  });

  try {
    const identities = await session.listIdentities();
    const discord = identities.find((i: any) => i?.provider === "discord");
    if (discord?.$id) {
      await session.deleteIdentity(String(discord.$id));
    }
  } catch {
    // ignore; unlink is best-effort
  }

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
      discordUserId: null,
      discordLinkedAt: null
    }
  });

  // Enqueue role removal job (best-effort).
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

    const jobDoc = buildRoleSyncJobDoc({
      userId: auth.userId,
      discordUserId: null,
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

  const res = NextResponse.json({ ok: true });
  // Keep session cookie unchanged; unlink is an account action only.
  res.headers.set("cache-control", "no-store");
  return res;
}
