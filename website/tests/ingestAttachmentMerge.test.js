import { describe, expect, it } from "bun:test";

import { resolveAttachmentsForExistingSignalPatch } from "../../convex/ingestAttachmentMerge";

describe("ingestAttachmentMerge", () => {
  it("preserves existing attachments for sparse non-delete events", () => {
    const existing = [
      {
        attachmentId: "a1",
        url: "https://cdn.discordapp.com/attachments/a1.png",
        name: "a1.png",
        contentType: "image/png",
        size: 123,
      },
    ];

    const result = resolveAttachmentsForExistingSignalPatch({
      eventType: "update",
      incomingAttachments: [],
      existingAttachments: existing,
    });

    expect(result).toEqual({
      attachments: existing,
      preservedExisting: true,
    });
  });

  it("replaces existing attachments when incoming attachments are present", () => {
    const result = resolveAttachmentsForExistingSignalPatch({
      eventType: "update",
      incomingAttachments: [
        {
          attachmentId: "a2",
          url: "https://cdn.discordapp.com/attachments/a2.png",
        },
      ],
      existingAttachments: [
        {
          attachmentId: "a1",
          url: "https://cdn.discordapp.com/attachments/a1.png",
        },
      ],
    });

    expect(result).toEqual({
      attachments: [
        {
          attachmentId: "a2",
          url: "https://cdn.discordapp.com/attachments/a2.png",
        },
      ],
      preservedExisting: false,
    });
  });

  it("does not patch attachments on delete when incoming attachments are missing", () => {
    const result = resolveAttachmentsForExistingSignalPatch({
      eventType: "delete",
      incomingAttachments: [],
      existingAttachments: [
        {
          attachmentId: "a1",
          url: "https://cdn.discordapp.com/attachments/a1.png",
        },
      ],
    });

    expect(result).toEqual({
      attachments: undefined,
      preservedExisting: false,
    });
  });
});
