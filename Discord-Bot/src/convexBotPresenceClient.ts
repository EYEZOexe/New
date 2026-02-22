import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const syncBotGuildsRef = makeFunctionReference<
  "mutation",
  {
    botToken: string;
    guilds: Array<{
      guildId: string;
      name: string;
      icon?: string;
    }>;
  },
  {
    ok: true;
    upserted: number;
    deactivated: number;
    total: number;
  }
>("discordBotPresence:syncBotGuilds");

const syncBotGuildChannelsRef = makeFunctionReference<
  "mutation",
  {
    botToken: string;
    guildId: string;
    channels: Array<{
      channelId: string;
      name: string;
      type?: number;
      parentId?: string;
      position?: number;
    }>;
  },
  {
    ok: true;
    guildId: string;
    upserted: number;
    deactivated: number;
    total: number;
  }
>("discordBotPresence:syncBotGuildChannels");

export class ConvexBotPresenceClient {
  private readonly client: ConvexHttpClient;
  private readonly botToken: string;

  constructor(args: { convexUrl: string; botToken: string }) {
    this.client = new ConvexHttpClient(args.convexUrl);
    this.botToken = args.botToken;
  }

  async syncGuilds(
    guilds: Array<{
      guildId: string;
      name: string;
      icon?: string;
    }>,
  ) {
    return await this.client.mutation(syncBotGuildsRef, {
      botToken: this.botToken,
      guilds,
    });
  }

  async syncGuildChannels(args: {
    guildId: string;
    channels: Array<{
      channelId: string;
      name: string;
      type?: number;
      parentId?: string;
      position?: number;
    }>;
  }) {
    return await this.client.mutation(syncBotGuildChannelsRef, {
      botToken: this.botToken,
      guildId: args.guildId,
      channels: args.channels,
    });
  }
}
