import { describe, expect, it } from "bun:test";
import {
  buildAutoCheckoutUrl,
  parseDisplayPriceToCents,
  parseProductIdFromPolicyExternalId,
  parseProductSlugFromPolicyExternalId,
} from "../app/payments/catalog/utils";

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

describe("catalog policy + price parsing", () => {
  it("extracts product id and slug from productId|slug policy ids", () => {
    expect(parseProductIdFromPolicyExternalId("350191|basic-plan")).toBe(350191);
    expect(parseProductSlugFromPolicyExternalId("350191|basic-plan")).toBe("basic-plan");
  });

  it("returns null when policy id has no numeric product id prefix", () => {
    expect(parseProductIdFromPolicyExternalId("basic-plan")).toBe(null);
  });

  it("parses display prices to cents", () => {
    expect(parseDisplayPriceToCents("€20")).toBe(2000);
    expect(parseDisplayPriceToCents("$1.00")).toBe(100);
    expect(parseDisplayPriceToCents("0")).toBe(0);
    expect(parseDisplayPriceToCents("free")).toBe(null);
  });
});
