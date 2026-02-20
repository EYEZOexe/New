import { describe, expect, it } from "bun:test";

import { resolveContentForExistingSignalPatch } from "../../convex/ingestContentMerge";

describe("ingestContentMerge", () => {
  it("preserves existing content for sparse attachment-only updates", () => {
    const result = resolveContentForExistingSignalPatch({
      eventType: "update",
      incomingContent: "",
      incomingAttachments: [
        {
          attachmentId: "a1",
          url: "https://cdn.discordapp.com/attachments/a1.png",
        },
      ],
      existingContent: "Existing signal content",
    });

    expect(result).toEqual({
      content: "Existing signal content",
      preservedExisting: true,
    });
  });

  it("uses incoming content for non-empty updates", () => {
    const result = resolveContentForExistingSignalPatch({
      eventType: "update",
      incomingContent: "Updated signal content",
      incomingAttachments: [],
      existingContent: "Existing signal content",
    });

    expect(result).toEqual({
      content: "Updated signal content",
      preservedExisting: false,
    });
  });

  it("does not preserve existing content for attachment-only create", () => {
    const result = resolveContentForExistingSignalPatch({
      eventType: "create",
      incomingContent: "",
      incomingAttachments: [
        {
          attachmentId: "a1",
          url: "https://cdn.discordapp.com/attachments/a1.png",
        },
      ],
      existingContent: "Existing signal content",
    });

    expect(result).toEqual({
      content: "",
      preservedExisting: false,
    });
  });
});
