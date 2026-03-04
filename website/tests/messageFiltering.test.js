import { describe, expect, it } from "bun:test";

import { applyMessageFiltering } from "../../convex/messageFiltering";

describe("message filtering", () => {
  it("removes blocked keywords while preserving remaining text", () => {
    const result = applyMessageFiltering("going live now", {
      blockedKeywords: ["live"],
    });

    expect(result.content).toBe("going now");
    expect(result.removedKeywordMatches).toBe(1);
    expect(result.removedUrlCount).toBe(0);
  });

  it("keeps allowlisted keywords even when blocklisted", () => {
    const result = applyMessageFiltering("going live now", {
      blockedKeywords: ["live"],
      allowedKeywords: ["live"],
    });

    expect(result.content).toBe("going live now");
    expect(result.removedKeywordMatches).toBe(0);
  });

  it("removes only blocked URL domains from content", () => {
    const result = applyMessageFiltering(
      "Read https://x.com/alpha and https://example.com/beta",
      {
        blockedDomains: ["x.com"],
      },
    );

    expect(result.content).toBe("Read and https://example.com/beta");
    expect(result.removedUrlCount).toBe(1);
  });

  it("keeps allowlisted domains when both lists contain similar hosts", () => {
    const result = applyMessageFiltering("Watch https://www.x.com/alpha now", {
      blockedDomains: ["x.com"],
      allowedDomains: ["www.x.com"],
    });

    expect(result.content).toBe("Watch https://www.x.com/alpha now");
    expect(result.removedUrlCount).toBe(0);
  });
});

