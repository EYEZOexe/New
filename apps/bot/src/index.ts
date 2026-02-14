import "dotenv/config";

import { Client, GatewayIntentBits, Partials } from "discord.js";
import * as sdk from "node-appwrite";
import { z } from "zod";

import { diffRoles } from "./role-sync.js";

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  APPWRITE_ENDPOINT: z.string().url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  APPWRITE_DATABASE_ID: z.string().min(1),
  APPWRITE_SIGNALS_COLLECTION_ID: z.string().min(1),
  APPWRITE_MIRRORS_COLLECTION_ID: z.string().min(1),
  CUSTOMER_GUILD_ID: z.string().min(1),
  // Optional (Phase 2 role sync worker)
  APPWRITE_DISCORD_ROLE_MAPPINGS_COLLECTION_ID: z.string().min(1).optional(),
  APPWRITE_ROLE_SYNC_JOBS_COLLECTION_ID: z.string().min(1).optional()
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  // eslint-disable-next-line no-console
  console.warn(
    "Bot is not configured (missing env vars). Copy apps/bot/.env.example to apps/bot/.env and set values. Skipping bot startup."
  );
  process.exit(0);
}
const env = envResult.data;

function sanitizeEnvValue(value: string): string {
  let v = String(value).trim();
  if (
    (v.startsWith("\"") && v.endsWith("\"") && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function normalizeAppwriteEndpoint(endpoint: string): string {
  // Normalize to ".../v1" regardless of what Coolify/cloudflared service URLs look like.
  // Common bad values we want to fix:
  // - https://appwrite.example (missing /v1)
  // - https://appwrite.example/v1/ (trailing slash)
  // - https://appwrite.example/v1/realtime (path too deep)
  const raw = sanitizeEnvValue(endpoint);
  const u = new URL(raw);
  const host = u.hostname.toLowerCase();
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";

  // In production behind Cloudflare tunnels, users often paste `http://...` service URLs.
  // The public Appwrite endpoint should be HTTPS, so default to upgrading unless local.
  const proto = u.protocol === "http:" && !isLocal ? "https:" : u.protocol;

  return `${proto}//${u.host}/v1`;
}

async function appwritePing(endpoint: string): Promise<void> {
  const url = `${endpoint}/ping`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        // Helps Appwrite route the request even if the endpoint has an upstream proxy.
        "X-Appwrite-Project": env.APPWRITE_PROJECT_ID
      }
    });
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.log("Appwrite ping:", {
      ok: res.ok,
      status: res.status,
      url,
      snippet: text.slice(0, 120)
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Appwrite ping failed:", {
      url,
      message: err?.message ?? String(err)
    });
  }
}

/**
 * MVP placeholder bot:
 * - Connects to Discord
 * - Connects to Appwrite realtime
 * - Logs new signal events
 *
 * Next steps:
 * - Load config + channel mappings
 * - Post into customer guild channels
 * - Write mirror mapping docs
 */

const discord = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

const appwriteEndpoint = normalizeAppwriteEndpoint(env.APPWRITE_ENDPOINT);
const appwrite = new sdk.Client()
  .setEndpoint(appwriteEndpoint)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);

const databases = new sdk.Databases(appwrite);

type AppwriteBaseDocument = {
  $id: string;
  $collectionId: string;
  $databaseId: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  $sequence: number;
};

type SignalDoc = AppwriteBaseDocument & {
  sourceMessageId?: string;
  sourceChannelId?: string;
  content?: string;
};

type RoleMappingDoc = AppwriteBaseDocument & {
  plan?: string;
  guildId?: string;
  roleIdsJson?: string;
};

type RoleSyncJobDoc = AppwriteBaseDocument & {
  userId?: string;
  discordUserId?: string | null;
  guildId?: string;
  desiredRoleIdsJson?: string;
  status?: "pending" | "processing" | "done" | "failed";
  attempts?: number;
  lastError?: string | null;
  lastAttemptAt?: string | null;
};

function parseRoleIdsJson(text: string | undefined | null): string[] {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length) : [];
  } catch {
    return [];
  }
}

async function discordApi(
  token: string,
  path: string,
  init: RequestInit & { jsonBody?: unknown } = {}
): Promise<{ ok: boolean; status: number; json: any; headers: Headers }> {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      ...(init.jsonBody !== undefined ? { "content-type": "application/json" } : {}),
      authorization: `Bot ${token}`,
      ...(init.headers ?? {})
    },
    body:
      init.jsonBody === undefined
        ? init.body
        : typeof init.jsonBody === "string"
          ? (init.jsonBody as string)
          : JSON.stringify(init.jsonBody)
  });

  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json, headers: res.headers };
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("Appwrite config:", {
    endpoint: appwriteEndpoint,
    projectId: env.APPWRITE_PROJECT_ID,
    databaseId: env.APPWRITE_DATABASE_ID
  });
  await appwritePing(appwriteEndpoint);

  discord.once("ready", () => {
    // eslint-disable-next-line no-console
    console.log(`Bot ready as ${discord.user?.tag}`);
  });

  await discord.login(env.DISCORD_BOT_TOKEN);

  // NOTE: node-appwrite (server SDK) does not currently include Realtime subscriptions.
  // For the MVP we use a polling loop. Later we can:
  // - run the bot as an Appwrite Function triggered by DB events, or
  // - use the WebSocket realtime API directly.
  let lastSeenCreatedAt = new Date(0).toISOString();

  async function pollOnce() {
    const res = await databases.listDocuments<SignalDoc>(
      env.APPWRITE_DATABASE_ID,
      env.APPWRITE_SIGNALS_COLLECTION_ID,
      [
        sdk.Query.greaterThan("$createdAt", lastSeenCreatedAt),
        sdk.Query.orderAsc("$createdAt"),
        sdk.Query.limit(25)
      ]
    );

    for (const doc of res.documents) {
      // eslint-disable-next-line no-console
      console.log("New signal:", {
        id: doc.$id,
        createdAt: doc.$createdAt,
        sourceChannelId: doc.sourceChannelId,
        contentPreview: (doc.content ?? "").slice(0, 120)
      });
      lastSeenCreatedAt = doc.$createdAt;
    }
  }

  // eslint-disable-next-line no-console
  console.log("Bot polling for new signals...");
  await pollOnce();

  const interval = setInterval(() => {
    pollOnce().catch((err) => console.error("pollOnce failed", err));
  }, 3_000);

  interval.unref?.();

  // Phase 2: role sync worker (optional)
  const roleMappingsCollectionId = env.APPWRITE_DISCORD_ROLE_MAPPINGS_COLLECTION_ID;
  const roleSyncJobsCollectionId = env.APPWRITE_ROLE_SYNC_JOBS_COLLECTION_ID;
  if (roleMappingsCollectionId && roleSyncJobsCollectionId) {
    const roleMappingsId: string = roleMappingsCollectionId;
    const roleSyncJobsId: string = roleSyncJobsCollectionId;

    // eslint-disable-next-line no-console
    console.log("Bot polling for role sync jobs...");

    async function pollRoleSyncOnce() {
      const mappingsRes = await databases.listDocuments<RoleMappingDoc>(
        env.APPWRITE_DATABASE_ID,
        roleMappingsId,
        [sdk.Query.limit(100)]
      );
      const guildMappings = mappingsRes.documents.filter((d) => d.guildId === env.CUSTOMER_GUILD_ID);

      const managedRoleIds = new Set<string>();
      for (const doc of guildMappings) {
        for (const r of parseRoleIdsJson(doc.roleIdsJson)) managedRoleIds.add(r);
      }

      const jobsRes = await databases.listDocuments<RoleSyncJobDoc>(
        env.APPWRITE_DATABASE_ID,
        roleSyncJobsId,
        [
          sdk.Query.equal("status", ["pending"]),
          sdk.Query.orderAsc("$createdAt"),
          sdk.Query.limit(10)
        ]
      );

      for (const job of jobsRes.documents) {
        const jobId = job.$id;
        const discordUserId = job.discordUserId ?? null;
        if (!discordUserId) {
          await databases.updateDocument(env.APPWRITE_DATABASE_ID, roleSyncJobsId, jobId, {
            status: "failed",
            attempts: (job.attempts ?? 0) + 1,
            lastError: "missing_discordUserId",
            lastAttemptAt: new Date().toISOString()
          });
          continue;
        }

        await databases.updateDocument(env.APPWRITE_DATABASE_ID, roleSyncJobsId, jobId, {
          status: "processing",
          lastAttemptAt: new Date().toISOString()
        });

        try {
          const desiredRoleIds = new Set(
            parseRoleIdsJson(job.desiredRoleIdsJson).filter((r) => managedRoleIds.has(r))
          );

          const memberRes = await discordApi(
            env.DISCORD_BOT_TOKEN,
            `/guilds/${encodeURIComponent(env.CUSTOMER_GUILD_ID)}/members/${encodeURIComponent(discordUserId)}`,
            { method: "GET" }
          );
          if (!memberRes.ok) {
            await databases.updateDocument(env.APPWRITE_DATABASE_ID, roleSyncJobsId, jobId, {
              status: "failed",
              attempts: (job.attempts ?? 0) + 1,
              lastError: `discord_member_fetch_failed:${memberRes.status}`,
              lastAttemptAt: new Date().toISOString()
            });
            continue;
          }

          const currentRoles = Array.isArray(memberRes.json?.roles) ? (memberRes.json.roles as string[]) : [];
          const currentManaged = currentRoles.filter((r) => managedRoleIds.has(r));
          const desired = Array.from(desiredRoleIds);
          const { toAdd, toRemove } = diffRoles({ desired, current: currentManaged });

          // eslint-disable-next-line no-console
          console.log("Role sync job diff:", {
            jobId,
            discordUserId,
            managedRoleCount: managedRoleIds.size,
            desiredCount: desired.length,
            toAdd,
            toRemove
          });

          for (const roleId of toAdd) {
            const r = await discordApi(
              env.DISCORD_BOT_TOKEN,
              `/guilds/${encodeURIComponent(env.CUSTOMER_GUILD_ID)}/members/${encodeURIComponent(
                discordUserId
              )}/roles/${encodeURIComponent(roleId)}`,
              { method: "PUT" }
            );
            if (!r.ok) throw new Error(`add_role_failed:${roleId}:${r.status}`);
          }
          for (const roleId of toRemove) {
            const r = await discordApi(
              env.DISCORD_BOT_TOKEN,
              `/guilds/${encodeURIComponent(env.CUSTOMER_GUILD_ID)}/members/${encodeURIComponent(
                discordUserId
              )}/roles/${encodeURIComponent(roleId)}`,
              { method: "DELETE" }
            );
            if (!r.ok) throw new Error(`remove_role_failed:${roleId}:${r.status}`);
          }

          await databases.updateDocument(env.APPWRITE_DATABASE_ID, roleSyncJobsId, jobId, {
            status: "done",
            attempts: job.attempts ?? 0,
            lastError: null
          });
        } catch (err: any) {
          await databases.updateDocument(env.APPWRITE_DATABASE_ID, roleSyncJobsId, jobId, {
            status: "failed",
            attempts: (job.attempts ?? 0) + 1,
            lastError: err?.message ?? String(err),
            lastAttemptAt: new Date().toISOString()
          });
        }
      }
    }

    const roleInterval = setInterval(() => {
      pollRoleSyncOnce().catch((err) => console.error("pollRoleSyncOnce failed", err));
    }, 5_000);
    roleInterval.unref?.();
  } else {
    // eslint-disable-next-line no-console
    console.log("Role sync worker disabled (missing role sync env vars).");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
