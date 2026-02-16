import { describe, expect, it } from "bun:test";

import { messageEventToSignalFields, parseIsoToMs } from "../convex/ingestUtils";

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
          url: "https://cdn/x.png",
          name: "x.png",
          contentType: "image/png",
          size: 123,
        },
      ],
      createdAt: 1771200000000,
    });
  });
});
