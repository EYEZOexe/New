import { describe, expect, it } from "bun:test";

import { messageEventToSignalFields, parseIsoToMs } from "../../convex/ingestUtils";

describe("ingestUtils", () => {
  it("parses ISO timestamps to ms", () => {
    expect(parseIsoToMs("2026-02-16T00:00:00.000Z")).toBe(1771200000000);
  });

  it("maps an ingest message event to signal fields", () => {
    const fields = messageEventToSignalFields(
      {
        event_type: "create",
        discord_message_id: "m1",
        discord_channel_id: "c1",
        discord_guild_id: "g1",
        content_clean: "hello",
        created_at: "2026-02-16T00:00:00.000Z",
        edited_at: null,
        deleted_at: null,
        attachments: [
          {
            discord_attachment_id: "a1",
            filename: "x.png",
            source_url: "https://cdn/x.png",
            size: 123,
            content_type: "image/png",
          },
        ],
      },
      { tenantKey: "t1", connectorId: "conn_01" },
    );

    expect(fields).toEqual({
      tenantKey: "t1",
      connectorId: "conn_01",
      sourceMessageId: "m1",
      sourceChannelId: "c1",
      sourceGuildId: "g1",
      content: "hello",
      attachments: [
        {
          attachmentId: "a1",
          url: "https://cdn/x.png",
          name: "x.png",
          contentType: "image/png",
          size: 123,
        },
      ],
      createdAt: 1771200000000,
    });
  });

  it("uses receivedAt fallback for delete events without deleted_at", () => {
    const fields = messageEventToSignalFields(
      {
        event_type: "delete",
        discord_message_id: "m2",
        discord_channel_id: "c1",
        discord_guild_id: "g1",
        content_clean: "",
        created_at: "2026-02-16T00:00:00.000Z",
        edited_at: null,
        deleted_at: null,
        attachments: [],
      },
      { tenantKey: "t1", connectorId: "conn_01" },
      { receivedAt: 1771300000000 },
    );

    expect(fields.deletedAt).toBe(1771300000000);
  });

  it("uses receivedAt fallback for update events without edited_at", () => {
    const fields = messageEventToSignalFields(
      {
        event_type: "update",
        discord_message_id: "m3",
        discord_channel_id: "c1",
        discord_guild_id: "g1",
        content_clean: "updated",
        created_at: "2026-02-16T00:00:00.000Z",
        edited_at: null,
        deleted_at: null,
        attachments: [],
      },
      { tenantKey: "t1", connectorId: "conn_01" },
      { receivedAt: 1771301000000 },
    );

    expect(fields.editedAt).toBe(1771301000000);
  });

  it("extracts embed image media into synthetic attachment refs", () => {
    const fields = messageEventToSignalFields(
      {
        event_type: "create",
        discord_message_id: "m4",
        discord_channel_id: "c1",
        discord_guild_id: "g1",
        content_clean: "signal text",
        created_at: "2026-02-16T00:00:00.000Z",
        edited_at: null,
        deleted_at: null,
        attachments: [],
        embeds: [
          {
            embed_index: 0,
            embed_type: "rich",
            title: "TradingView",
            raw_json: {
              image: {
                url: "https://media.discordapp.net/attachments/1/2/chart.png?width=600&height=400",
              },
            },
          },
        ],
      },
      { tenantKey: "t1", connectorId: "conn_01" },
    );

    expect(fields.attachments).toEqual([
      {
        attachmentId: "embed:0:image",
        url: "https://media.discordapp.net/attachments/1/2/chart.png?width=600&height=400",
        name: "TradingView",
      },
    ]);
  });

  it("extracts embed image URLs when format is provided in query params", () => {
    const fields = messageEventToSignalFields(
      {
        event_type: "create",
        discord_message_id: "m5",
        discord_channel_id: "c1",
        discord_guild_id: "g1",
        content_clean: "signal text",
        created_at: "2026-02-16T00:00:00.000Z",
        edited_at: null,
        deleted_at: null,
        attachments: [],
        embeds: [
          {
            embed_index: 0,
            embed_type: "rich",
            title: "Chart",
            raw_json: {
              image: {
                url: "https://cdn.example.com/media/preview?format=png",
              },
            },
          },
        ],
      },
      { tenantKey: "t1", connectorId: "conn_01" },
    );

    expect(fields.attachments).toEqual([
      {
        attachmentId: "embed:0:image",
        url: "https://cdn.example.com/media/preview?format=png",
        name: "Chart",
      },
    ]);
  });
});
