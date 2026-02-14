/**
 * DEPRECATED: Prefer running Appwrite operational workflows via MCP.
 * See `docs/appwrite-mcp-ops.md`.
 *
 * Appwrite bootstrap script (idempotent-ish).
 *
 * Creates:
 * - Database
 * - Teams
 * - Collections + attributes + indexes
 *
 * Usage:
 *   APPWRITE_ENDPOINT="https://appwrite.g3netic.com/v1" \
 *   APPWRITE_PROJECT_ID="..." \
 *   APPWRITE_API_KEY="..." \
 *   node scripts/appwrite/bootstrap.mjs
 *
 * Notes:
 * - This script uses Appwrite REST APIs via fetch to reduce SDK coupling.
 * - It never prints secrets.
 */

import fs from "node:fs";

const DEFAULTS = {
  databaseId: "crypto",
  teams: {
    admins: "admins",
    paid: "paid",
    collectors: "collectors"
  },
  buckets: {
    signalAssets: "signal_assets"
  },
  collections: {
    signals: "signals",
    mirrors: "mirrors",
    profiles: "profiles",
    subscriptions: "subscriptions",
    webhookEvents: "webhook_events",
    webhookFailures: "webhook_failures",
    channelMappings: "channel_mappings"
  }
};

function parseArgs(argv) {
  const args = {
    envFile: undefined,
    dryRun: undefined
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env-file") {
      args.envFile = argv[i + 1];
      i++;
      continue;
    }
    if (a === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function loadEnvFile(path) {
  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    // Remove optional surrounding quotes
    value = value.replace(/^"(.*)"$/, "$1");
    value = value.replace(/^'(.*)'$/, "$1");
    // Do not override existing env vars
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optionalEnv(name, fallback) {
  return process.env[name] || fallback;
}

const args = parseArgs(process.argv.slice(2));
if (args.envFile) loadEnvFile(args.envFile);
if (process.env.APPWRITE_ENV_FILE) loadEnvFile(process.env.APPWRITE_ENV_FILE);

const dryRun =
  args.dryRun === true ||
  process.env.APPWRITE_DRY_RUN === "1" ||
  process.env.APPWRITE_DRY_RUN === "true";

const endpoint = requiredEnv("APPWRITE_ENDPOINT").replace(/\/$/, "");
const projectId = requiredEnv("APPWRITE_PROJECT_ID");
// Allow running without a real key for local verification.
const apiKey = dryRun ? (process.env.APPWRITE_API_KEY || "dry-run") : requiredEnv("APPWRITE_API_KEY");

const databaseId = optionalEnv("APPWRITE_DATABASE_ID", DEFAULTS.databaseId);

const teamAdminsId = optionalEnv("APPWRITE_TEAM_ADMINS_ID", DEFAULTS.teams.admins);
const teamPaidId = optionalEnv("APPWRITE_TEAM_PAID_ID", DEFAULTS.teams.paid);
const teamCollectorsId = optionalEnv("APPWRITE_TEAM_COLLECTORS_ID", DEFAULTS.teams.collectors);

const signalsCollectionId = optionalEnv(
  "APPWRITE_SIGNALS_COLLECTION_ID",
  DEFAULTS.collections.signals
);
const mirrorsCollectionId = optionalEnv(
  "APPWRITE_MIRRORS_COLLECTION_ID",
  DEFAULTS.collections.mirrors
);
const profilesCollectionId = optionalEnv(
  "APPWRITE_PROFILES_COLLECTION_ID",
  DEFAULTS.collections.profiles
);
const subscriptionsCollectionId = optionalEnv(
  "APPWRITE_SUBSCRIPTIONS_COLLECTION_ID",
  DEFAULTS.collections.subscriptions
);
const webhookEventsCollectionId = optionalEnv(
  "APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID",
  DEFAULTS.collections.webhookEvents
);
const webhookFailuresCollectionId = optionalEnv(
  "APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID",
  DEFAULTS.collections.webhookFailures
);
const channelMappingsCollectionId = optionalEnv(
  "APPWRITE_CHANNEL_MAPPINGS_COLLECTION_ID",
  DEFAULTS.collections.channelMappings
);

const signalAssetsBucketId = optionalEnv(
  "APPWRITE_SIGNAL_ASSETS_BUCKET_ID",
  DEFAULTS.buckets.signalAssets
);

const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey
};

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function appwriteFetch(method, path, body) {
  if (dryRun) {
    console.log(`[DRY RUN] ${method} ${path} ${body ? JSON.stringify(body) : ""}`);
    return { dryRun: true };
  }

  const res = await fetch(`${endpoint}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;
  if (res.ok) return json;

  const err = new Error(
    (json && json.message) || `Appwrite error ${res.status} on ${method} ${path}`
  );
  // attach some useful properties without logging secrets
  err.status = res.status;
  err.type = json?.type;
  err.response = json;
  throw err;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isConflict(err) {
  return err && (err.status === 409 || err.code === 409);
}

async function ensure(name, fn) {
  try {
    const result = await fn();
    console.log(`✔ created: ${name}`);
    return { created: true, result };
  } catch (err) {
    if (isConflict(err)) {
      console.log(`↷ exists: ${name}`);
      return { created: false, result: null };
    }
    console.error(`✖ failed: ${name}`);
    throw err;
  }
}

function permissionRead(role) {
  return `read(\"${role}\")`;
}
function permissionCreate(role) {
  return `create(\"${role}\")`;
}
function permissionUpdate(role) {
  return `update(\"${role}\")`;
}
function permissionDelete(role) {
  return `delete(\"${role}\")`;
}
function roleTeam(teamId) {
  return `team:${teamId}`;
}
function roleUsers() {
  return `users`;
}

async function ensureBucket({ bucketId, name, permissions, fileSecurity = false }) {
  // POST /storage/buckets
  return ensure(`bucket:${bucketId}`, () =>
    appwriteFetch("POST", "/storage/buckets", {
      bucketId,
      name,
      permissions,
      fileSecurity,
      enabled: true,
      // Appwrite hard cap is typically 30MB; this is optional but explicit.
      maximumFileSize: 30_000_000,
      allowedFileExtensions: ["jpg", "jpeg", "png", "gif", "webp"],
      compression: "none",
      encryption: false,
      antivirus: false,
      transformations: true
    })
  );
}

async function retry(name, fn, { retries = 8, baseMs = 400 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // If it is a conflict, it's not retryable.
      if (isConflict(err)) throw err;
      const wait = Math.min(8_000, baseMs * 2 ** i);
      console.log(`… retrying ${name} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function ensureDatabase() {
  // POST /databases
  return ensure(`database:${databaseId}`, () =>
    appwriteFetch("POST", "/databases", {
      databaseId,
      name: "crypto",
      enabled: true
    })
  );
}

async function ensureTeam(teamId, name) {
  // POST /teams
  return ensure(`team:${teamId}`, () =>
    appwriteFetch("POST", "/teams", {
      teamId,
      name
    })
  );
}

async function ensureCollection({ collectionId, name, permissions, documentSecurity }) {
  // POST /databases/{databaseId}/collections
  return ensure(`collection:${collectionId}`, () =>
    appwriteFetch("POST", `/databases/${databaseId}/collections`, {
      collectionId,
      name,
      permissions,
      documentSecurity,
      enabled: true
    })
  );
}

async function ensureStringAttribute({ collectionId, key, size, required = false, array = false }) {
  // POST /databases/{databaseId}/collections/{collectionId}/attributes/string
  return ensure(`attr:string:${collectionId}.${key}`, () =>
    appwriteFetch(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/string`,
      {
        key,
        size,
        required,
        array
      }
    )
  );
}

async function ensureTextAttribute({ collectionId, key, required = false, array = false, defaultValue }) {
  // POST /databases/{databaseId}/collections/{collectionId}/attributes/text
  // NOTE: On Appwrite 1.7.4 self-hosted, `text` is available but `longtext` may not be.
  return ensure(`attr:text:${collectionId}.${key}`, () =>
    appwriteFetch(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/text`,
      {
        key,
        required,
        array,
        // Appwrite 1.7.x does not allow defaults on required attributes.
        ...(required || defaultValue === undefined ? {} : { default: defaultValue })
      }
    )
  );
}

async function ensureIntegerAttribute({ collectionId, key, required = false, array = false, min, max, defaultValue }) {
  // POST /databases/{databaseId}/collections/{collectionId}/attributes/integer
  return ensure(`attr:integer:${collectionId}.${key}`, () =>
    appwriteFetch(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/integer`,
      {
        key,
        required,
        array,
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
        // Appwrite 1.7.x does not allow defaults on required attributes.
        ...(required || defaultValue === undefined ? {} : { default: defaultValue })
      }
    )
  );
}

async function ensureBooleanAttribute({ collectionId, key, required = false, array = false, defaultValue }) {
  return ensure(`attr:boolean:${collectionId}.${key}`, () =>
    appwriteFetch(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/boolean`,
      {
        key,
        required,
        array,
        // Appwrite 1.7.x does not allow defaults on required attributes.
        ...(required || defaultValue === undefined ? {} : { default: defaultValue })
      }
    )
  );
}

async function ensureDatetimeAttribute({ collectionId, key, required = false, array = false }) {
  return ensure(`attr:datetime:${collectionId}.${key}`, () =>
    appwriteFetch(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/datetime`,
      { key, required, array }
    )
  );
}

async function ensureEnumAttribute({ collectionId, key, elements, required = false, array = false, defaultValue }) {
  return ensure(`attr:enum:${collectionId}.${key}`, () =>
    appwriteFetch(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/enum`,
      {
        key,
        elements,
        required,
        array,
        // Appwrite 1.7.x does not allow defaults on required attributes.
        ...(required || defaultValue === undefined ? {} : { default: defaultValue })
      }
    )
  );
}

async function ensureIndex({ collectionId, key, type = "key", attributes, orders = [] }) {
  // POST /databases/{databaseId}/collections/{collectionId}/indexes
  return ensure(`index:${collectionId}.${key}`, () =>
    retry(`index:${collectionId}.${key}`, () =>
      appwriteFetch(
        "POST",
        `/databases/${databaseId}/collections/${collectionId}/indexes`,
        {
          key,
          type,
          attributes,
          orders
        }
      )
    )
  );
}

async function main() {
  console.log("Appwrite bootstrap starting");
  if (dryRun) console.log("- mode:     DRY RUN (no network calls)");
  console.log(`- endpoint: ${endpoint}`);
  console.log(`- project:  ${projectId}`);
  console.log(`- db:       ${databaseId}`);

  await ensureDatabase();

  await ensureTeam(teamAdminsId, "Admins");
  await ensureTeam(teamPaidId, "Paid");
  await ensureTeam(teamCollectorsId, "Collectors");

  const permsSignals = [
    permissionRead(roleTeam(teamPaidId)),
    permissionRead(roleTeam(teamAdminsId)),
    permissionCreate(roleTeam(teamCollectorsId)),
    permissionUpdate(roleTeam(teamCollectorsId)),
    permissionDelete(roleTeam(teamCollectorsId))
  ];

  const permsAdminOnly = [
    permissionRead(roleTeam(teamAdminsId)),
    permissionCreate(roleTeam(teamAdminsId)),
    permissionUpdate(roleTeam(teamAdminsId)),
    permissionDelete(roleTeam(teamAdminsId))
  ];

  const permsUserCreateAdminRead = [
    permissionCreate(roleUsers()),
    permissionRead(roleTeam(teamAdminsId))
  ];

  const permsPaidReadAdminWrite = [
    permissionRead(roleTeam(teamPaidId)),
    permissionRead(roleTeam(teamAdminsId)),
    permissionCreate(roleTeam(teamCollectorsId)),
    permissionUpdate(roleTeam(teamCollectorsId)),
    permissionDelete(roleTeam(teamCollectorsId))
  ];

  // Storage buckets
  await ensureBucket({
    bucketId: signalAssetsBucketId,
    name: "Signal Assets",
    permissions: permsPaidReadAdminWrite,
    fileSecurity: false
  });

  // Collections
  await ensureCollection({
    collectionId: signalsCollectionId,
    name: "Signals",
    documentSecurity: false,
    permissions: permsSignals
  });

  await ensureCollection({
    collectionId: mirrorsCollectionId,
    name: "Mirrors",
    documentSecurity: false,
    permissions: permsAdminOnly
  });

  await ensureCollection({
    collectionId: profilesCollectionId,
    name: "Profiles",
    documentSecurity: true,
    permissions: permsUserCreateAdminRead
  });

  await ensureCollection({
    collectionId: subscriptionsCollectionId,
    name: "Subscriptions",
    documentSecurity: true,
    permissions: permsUserCreateAdminRead
  });

  await ensureCollection({
    collectionId: webhookEventsCollectionId,
    name: "Webhook Events",
    documentSecurity: false,
    permissions: permsAdminOnly
  });

  await ensureCollection({
    collectionId: webhookFailuresCollectionId,
    name: "Webhook Failures",
    documentSecurity: false,
    permissions: permsAdminOnly
  });

  await ensureCollection({
    collectionId: channelMappingsCollectionId,
    name: "Channel Mappings",
    documentSecurity: false,
    permissions: permsAdminOnly
  });

  // Attributes: signals
  await ensureStringAttribute({
    collectionId: signalsCollectionId,
    key: "sourceMessageId",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: signalsCollectionId,
    key: "sourceChannelId",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: signalsCollectionId,
    key: "sourceThreadId",
    size: 64,
    required: false
  });
  await ensureStringAttribute({
    collectionId: signalsCollectionId,
    key: "authorId",
    size: 64,
    required: false
  });
  await ensureStringAttribute({
    collectionId: signalsCollectionId,
    key: "authorName",
    size: 128,
    required: false
  });
  // Discord message content is max ~2000 chars, so a 4096 varchar is safe.
  // Using a smaller size avoids Appwrite 1.7.x `attribute_limit_exceeded` errors.
  await ensureStringAttribute({
    collectionId: signalsCollectionId,
    key: "content",
    size: 4096,
    required: false
  });
  await ensureDatetimeAttribute({
    collectionId: signalsCollectionId,
    key: "editedAt",
    required: false
  });
  await ensureDatetimeAttribute({
    collectionId: signalsCollectionId,
    key: "deletedAt",
    required: false
  });

  // Attributes: mirrors
  await ensureStringAttribute({
    collectionId: mirrorsCollectionId,
    key: "sourceMessageId",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: mirrorsCollectionId,
    key: "customerGuildId",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: mirrorsCollectionId,
    key: "customerChannelId",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: mirrorsCollectionId,
    key: "mirroredMessageId",
    size: 64,
    required: true
  });
  await ensureDatetimeAttribute({
    collectionId: mirrorsCollectionId,
    key: "lastSyncedAt",
    required: false
  });

  // Attributes: profiles
  await ensureStringAttribute({
    collectionId: profilesCollectionId,
    key: "userId",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: profilesCollectionId,
    key: "discordUserId",
    size: 64,
    required: false
  });
  await ensureDatetimeAttribute({
    collectionId: profilesCollectionId,
    key: "discordLinkedAt",
    required: false
  });

  // Attributes: subscriptions
  await ensureStringAttribute({
    collectionId: subscriptionsCollectionId,
    key: "userId",
    size: 64,
    required: true
  });
  await ensureEnumAttribute({
    collectionId: subscriptionsCollectionId,
    key: "status",
    elements: ["active", "inactive", "cancelled", "past_due"],
    // Appwrite 1.7.x does not allow defaults on required attributes.
    // We keep it required and set the default at the application layer.
    required: true
  });
  await ensureStringAttribute({
    collectionId: subscriptionsCollectionId,
    key: "plan",
    size: 64,
    required: false
  });
  await ensureStringAttribute({
    collectionId: subscriptionsCollectionId,
    key: "sellappOrderId",
    size: 128,
    required: false
  });
  await ensureDatetimeAttribute({
    collectionId: subscriptionsCollectionId,
    key: "currentPeriodEnd",
    required: false
  });

  // Attributes: webhook_events
  await ensureStringAttribute({
    collectionId: webhookEventsCollectionId,
    key: "provider",
    size: 32,
    required: true
  });
  await ensureStringAttribute({
    collectionId: webhookEventsCollectionId,
    key: "eventId",
    size: 128,
    required: true
  });
  await ensureStringAttribute({
    collectionId: webhookEventsCollectionId,
    key: "orderId",
    size: 128,
    required: false
  });
  await ensureDatetimeAttribute({
    collectionId: webhookEventsCollectionId,
    key: "processedAt",
    required: false
  });
  await ensureStringAttribute({
    collectionId: webhookEventsCollectionId,
    key: "payloadHash",
    size: 128,
    required: false
  });

  // Attributes: webhook_failures
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "provider",
    size: 32,
    required: true
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "event",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "eventId",
    size: 256,
    required: true
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "orderId",
    size: 128,
    required: false
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "store",
    size: 128,
    required: false
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "email",
    size: 256,
    required: false
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "payloadHash",
    size: 128,
    required: false
  });
  await ensureTextAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "bodyText",
    required: true
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "errorCode",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "errorMessage",
    size: 1024,
    required: false
  });
  await ensureIntegerAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "errorStatus",
    required: false
  });
  await ensureStringAttribute({
    collectionId: webhookFailuresCollectionId,
    key: "errorType",
    size: 128,
    required: false
  });

  // Attributes: channel_mappings
  await ensureStringAttribute({
    collectionId: channelMappingsCollectionId,
    key: "sourceChannelId",
    size: 64,
    required: true
  });
  await ensureStringAttribute({
    collectionId: channelMappingsCollectionId,
    key: "sourceThreadId",
    size: 64,
    required: false
  });
  await ensureStringAttribute({
    collectionId: channelMappingsCollectionId,
    key: "customerChannelId",
    size: 64,
    required: true
  });
  await ensureBooleanAttribute({
    collectionId: channelMappingsCollectionId,
    key: "enabled",
    // Default must be applied in application layer for Appwrite 1.7.x.
    required: true
  });

  // Indexes (with retries because Appwrite may take time to make attributes available)
  await ensureIndex({
    collectionId: signalsCollectionId,
    key: "idx_sourceChannelId",
    type: "key",
    attributes: ["sourceChannelId"]
  });
  await ensureIndex({
    collectionId: mirrorsCollectionId,
    key: "idx_sourceMessageId",
    type: "key",
    attributes: ["sourceMessageId"]
  });
  await ensureIndex({
    collectionId: profilesCollectionId,
    key: "idx_userId",
    type: "unique",
    attributes: ["userId"]
  });
  await ensureIndex({
    collectionId: subscriptionsCollectionId,
    key: "idx_userId",
    type: "unique",
    attributes: ["userId"]
  });
  await ensureIndex({
    collectionId: webhookEventsCollectionId,
    key: "idx_eventId",
    type: "unique",
    attributes: ["eventId"]
  });
  await ensureIndex({
    collectionId: webhookFailuresCollectionId,
    key: "idx_eventId",
    type: "key",
    attributes: ["eventId"]
  });
  await ensureIndex({
    collectionId: webhookFailuresCollectionId,
    key: "idx_errorCode",
    type: "key",
    attributes: ["errorCode"]
  });
  await ensureIndex({
    collectionId: channelMappingsCollectionId,
    key: "idx_sourceChannelId",
    type: "key",
    attributes: ["sourceChannelId"]
  });

  console.log("\nBootstrap complete.");
  console.log("Use these IDs in env vars:");
  console.log(`APPWRITE_DATABASE_ID=${databaseId}`);
  console.log(`APPWRITE_SIGNALS_COLLECTION_ID=${signalsCollectionId}`);
  console.log(`APPWRITE_MIRRORS_COLLECTION_ID=${mirrorsCollectionId}`);
  console.log(`APPWRITE_PROFILES_COLLECTION_ID=${profilesCollectionId}`);
  console.log(`APPWRITE_SUBSCRIPTIONS_COLLECTION_ID=${subscriptionsCollectionId}`);
  console.log(`APPWRITE_WEBHOOK_EVENTS_COLLECTION_ID=${webhookEventsCollectionId}`);
  console.log(`APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID=${webhookFailuresCollectionId}`);
  console.log(`APPWRITE_CHANNEL_MAPPINGS_COLLECTION_ID=${channelMappingsCollectionId}`);
  console.log(`APPWRITE_SIGNAL_ASSETS_BUCKET_ID=${signalAssetsBucketId}`);
  console.log(`APPWRITE_TEAM_ADMINS_ID=${teamAdminsId}`);
  console.log(`APPWRITE_TEAM_PAID_ID=${teamPaidId}`);
  console.log(`APPWRITE_TEAM_COLLECTORS_ID=${teamCollectorsId}`);
}

main().catch((err) => {
  console.error(err?.response || err);
  process.exit(1);
});
