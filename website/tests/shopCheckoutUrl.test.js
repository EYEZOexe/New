import { describe, expect, it } from "bun:test";

import { buildCheckoutStatusUrl, buildCheckoutUrl } from "../app/shop/utils";

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

describe("buildCheckoutStatusUrl", () => {
  it("builds a checkout return url with launch metadata", () => {
    const result = buildCheckoutStatusUrl({
      tier: "advanced",
      durationDays: 30,
      checkoutUrl: "https://g3netic.sell.app/product/advanced-plan?quantity=1",
      launch: "opened",
    });
    const url = new URL(result, "https://app.example.com");

    expect(url.pathname).toBe("/checkout/return");
    expect(url.searchParams.get("tier")).toBe("advanced");
    expect(url.searchParams.get("duration_days")).toBe("30");
    expect(url.searchParams.get("launch")).toBe("opened");
    expect(url.searchParams.get("checkout_url")).toBe(
      "https://g3netic.sell.app/product/advanced-plan?quantity=1",
    );
  });

  it("omits invalid checkout urls", () => {
    const result = buildCheckoutStatusUrl({
      tier: "pro",
      durationDays: 7,
      checkoutUrl: "://invalid-checkout-url",
      launch: "blocked",
    });
    const url = new URL(result, "https://app.example.com");

    expect(url.pathname).toBe("/checkout/return");
    expect(url.searchParams.get("tier")).toBe("pro");
    expect(url.searchParams.get("duration_days")).toBe("7");
    expect(url.searchParams.get("launch")).toBe("blocked");
    expect(url.searchParams.get("checkout_url")).toBeNull();
  });
});
