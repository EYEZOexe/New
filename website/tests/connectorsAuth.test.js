import { describe, expect, it } from "bun:test";

import { parseBearerToken, sha256Hex } from "../../convex/connectorsAuth";

describe("connectorsAuth", () => {
  it("computes sha256 hex for known input", async () => {
    // sha256("test") from common reference vectors
    const digest = await sha256Hex("test");
    expect(digest).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });

  it("parses bearer tokens case-insensitively", () => {
    expect(parseBearerToken("Bearer abc")).toBe("abc");
    expect(parseBearerToken("bearer abc")).toBe("abc");
    expect(parseBearerToken("BEARER abc")).toBe("abc");
  });

  it("rejects invalid bearer headers", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
    expect(parseBearerToken("Token abc")).toBeNull();
    expect(parseBearerToken("Bearer")).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
  });
});

