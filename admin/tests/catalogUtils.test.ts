import { describe, expect, it } from "bun:test";
import { buildAutoCheckoutUrl } from "../app/payments/catalog/utils";

describe("catalog checkout URL generation", () => {
  it("builds slug-based product URLs", () => {
    const url = buildAutoCheckoutUrl({
      storefrontUrl: "https://g3netic.sell.app",
      policyScope: "product",
      policyExternalId: "basic-plan",
    });

    expect(url).toBe("https://g3netic.sell.app/product/basic-plan");
  });

  it("supports productId|slug policy format", () => {
    const url = buildAutoCheckoutUrl({
      storefrontUrl: "https://g3netic.sell.app",
      policyScope: "product",
      policyExternalId: "349820|basic-plan",
    });

    expect(url).toBe("https://g3netic.sell.app/product/basic-plan");
  });

  it("rejects numeric-only product ids for auto URL generation", () => {
    const url = buildAutoCheckoutUrl({
      storefrontUrl: "https://g3netic.sell.app",
      policyScope: "product",
      policyExternalId: "349820",
    });

    expect(url).toBe(null);
  });
});
