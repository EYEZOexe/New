import { describe, expect, it } from "bun:test";

import { shouldDeleteMirroredSignalRow } from "../../convex/retentionPolicy";

describe("retention policy", () => {
  it("retains active mirrored signal links even when they are older than 30 days", () => {
    const cutoffMs = Date.UTC(2026, 1, 18);

    expect(
      shouldDeleteMirroredSignalRow({
        lastMirroredAt: Date.UTC(2024, 6, 1),
        cutoffMs,
      }),
    ).toBe(false);
  });

  it("deletes mirrored signal links only after the mirrored message was deleted before the cutoff", () => {
    const cutoffMs = Date.UTC(2026, 1, 18);

    expect(
      shouldDeleteMirroredSignalRow({
        lastMirroredAt: Date.UTC(2024, 6, 1),
        deletedAt: Date.UTC(2026, 1, 1),
        cutoffMs,
      }),
    ).toBe(true);
  });
});
