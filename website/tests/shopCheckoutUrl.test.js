import { describe, expect, it } from "bun:test";

import { buildCheckoutUrl } from "../app/shop/utils";

describe("buildCheckoutUrl", () => {
  it("appends checkout metadata and normalized viewer email", () => {
    const result = buildCheckoutUrl(
      "https://g3netic.sell.app/product/trial?quantity=1",
      "pro",
      7,
      " Test@Gmail.com ",
    );
    const url = new URL(result);

    expect(url.searchParams.get("source")).toBe("website_shop");
    expect(url.searchParams.get("tier")).toBe("pro");
    expect(url.searchParams.get("duration_days")).toBe("7");
    expect(url.searchParams.get("email")).toBe("test@gmail.com");
  });

  it("does not append invalid viewer email", () => {
    const result = buildCheckoutUrl(
      "https://g3netic.sell.app/product/trial",
      "pro",
      7,
      "not-an-email",
    );
    const url = new URL(result);

    expect(url.searchParams.get("email")).toBeNull();
  });

  it("returns base url when checkout url is malformed", () => {
    const malformed = "://invalid-url";
    const result = buildCheckoutUrl(malformed, "basic", 30, "test@gmail.com");
    expect(result).toBe(malformed);
  });
});
