import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthContext } from "../../../../../lib/auth";
import { getAppwritePublicConfig, getAppwriteServerConfig } from "../../../../../lib/appwrite-server";
import { createAppwriteAdminRestClient } from "../../../../../lib/appwrite-admin-rest";
import { createAppwriteSessionRestClient } from "../../../../../lib/appwrite-session-rest";

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

  let discordUserIdForRemoval: string | null = null;
  try {
    const identities = await session.listIdentities();
    const discord = identities.find((i: any) => i?.provider === "discord");
    if (discord?.$id) {
      // Capture provider UID so we can remove roles even after unlinking identity.
      if (typeof discord?.providerUid === "string" && discord.providerUid.length) {
        discordUserIdForRemoval = discord.providerUid;
      }
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

  // Clear profile linkage. Avoid writing explicit nulls (Appwrite versions differ on nullable handling).
  try {
    await adminDb.deleteDocument({ databaseId, collectionId: profilesCollectionId, documentId: auth.userId });
  } catch {
    // ignore (404 etc.)
  }
  await adminDb.upsertDocumentPut({
    databaseId,
    collectionId: profilesCollectionId,
    documentId: auth.userId,
    data: { userId: auth.userId }
  });

  // Enqueue role removal job (best-effort).
  try {
    const roleSyncJobsCollectionId = process.env.APPWRITE_ROLE_SYNC_JOBS_COLLECTION_ID ?? "role_sync_jobs";
    const customerGuildId = process.env.CUSTOMER_GUILD_ID ?? "";
    const jobDoc: Record<string, unknown> = {
      userId: auth.userId,
      guildId: customerGuildId,
      desiredRoleIdsJson: "[]",
      status: "pending",
      attempts: 0
    };
    if (discordUserIdForRemoval) jobDoc.discordUserId = discordUserIdForRemoval;

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
