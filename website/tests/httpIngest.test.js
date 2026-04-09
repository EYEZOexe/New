import { describe, expect, it } from "bun:test";

import { buildInlineHydrationCandidates } from "../../convex/httpIngest";

describe("httpIngest", () => {
  it("includes embed-only image media in inline hydration candidates", () => {
    const candidates = buildInlineHydrationCandidates({
      tenantKey: "t1",
      connectorId: "conn_01",
      receivedAt: 1771300000000,
      messages: [
        {
          event_type: "create",
          discord_message_id: "1491884989476770025",
          discord_channel_id: "c1",
          discord_guild_id: "g1",
          content_clean: "",
          created_at: "2026-04-09T00:00:00.000Z",
          edited_at: null,
          deleted_at: null,
          attachments: [],
          embeds: [
            {
              embed_index: 0,
              embed_type: "rich",
              title: "Signal chart",
              raw_json: {
                image: {
                  proxyURL: "https://media.discordapp.net/attachments/1/2/3",
                },
              },
            },
          ],
        },
      ],
    });

    expect(candidates).toEqual([
      {
        tenantKey: "t1",
        connectorId: "conn_01",
        sourceMessageId: "1491884989476770025",
        sourceChannelId: "c1",
        receivedAt: 1771300000000,
        attachments: [
          {
            attachmentId: "embed:0:image",
            url: "https://media.discordapp.net/attachments/1/2/3",
            name: "Signal chart",
          },
        ],
      },
    ]);
  });
});
