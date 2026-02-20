import { describe, expect, it } from "bun:test";

import { sanitizeAppRedirectPath } from "../lib/redirectPath";

describe("sanitizeAppRedirectPath", () => {
  it("allows safe in-app paths", () => {
    expect(sanitizeAppRedirectPath("/dashboard", "/fallback")).toBe("/dashboard");
    expect(sanitizeAppRedirectPath("/workspace/news", "/fallback")).toBe("/workspace/news");
  });

  it("blocks unsafe or malformed paths", () => {
    expect(sanitizeAppRedirectPath("https://evil.example", "/fallback")).toBe("/fallback");
    expect(sanitizeAppRedirectPath("//evil.example", "/fallback")).toBe("/fallback");
    expect(sanitizeAppRedirectPath("/good\nbad", "/fallback")).toBe("/fallback");
    expect(sanitizeAppRedirectPath("", "/fallback")).toBe("/fallback");
  });
});
