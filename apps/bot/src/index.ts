import "dotenv/config";

import { Client, GatewayIntentBits, Partials } from "discord.js";
import * as sdk from "node-appwrite";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  APPWRITE_ENDPOINT: z.string().url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  APPWRITE_DATABASE_ID: z.string().min(1),
  APPWRITE_SIGNALS_COLLECTION_ID: z.string().min(1),
  APPWRITE_MIRRORS_COLLECTION_ID: z.string().min(1),
  CUSTOMER_GUILD_ID: z.string().min(1)
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

const appwrite = new sdk.Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
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

async function main() {
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
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
