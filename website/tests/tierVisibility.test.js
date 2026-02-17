import { describe, expect, it } from "bun:test";
import {
  isTierAtLeast,
  filterVisibleChannelIdsForTier,
} from "../../convex/tierVisibility";

describe("tier visibility", () => {
  it("orders tiers basic < advanced < pro", () => {
    expect(isTierAtLeast("advanced", "basic")).toBe(true);
    expect(isTierAtLeast("basic", "advanced")).toBe(false);
  });

  it("hides channels unless explicitly dashboard enabled", () => {
    const visible = filterVisibleChannelIdsForTier("advanced", [
      { channelId: "c1", dashboardEnabled: false, minimumTier: "basic" },
      { channelId: "c2", dashboardEnabled: true, minimumTier: "pro" },
      { channelId: "c3", dashboardEnabled: true, minimumTier: "basic" },
    ]);
    expect(visible).toEqual(["c3"]);
  });
});
