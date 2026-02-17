import { describe, expect, it } from "bun:test";
import {
  assertLinkedPolicyEnabled,
  assertUniqueTierDuration,
  assertValidCheckoutUrl,
  asShopCatalogErrorShape,
} from "../../convex/shopCatalogUtils";

function getErrorCode(error) {
  return asShopCatalogErrorShape(error).code;
}

describe("shopCatalogUtils", () => {
  it("rejects invalid checkoutUrl", () => {
    expect(() => assertValidCheckoutUrl("http://sell.example/checkout")).toThrow();
    try {
      assertValidCheckoutUrl("http://sell.example/checkout");
      throw new Error("expected error");
    } catch (error) {
      expect(getErrorCode(error)).toBe("invalid_checkout_url");
    }
  });

  it("rejects duplicate tier+duration variants", () => {
    expect(() =>
      assertUniqueTierDuration(
        [{ _id: "v1", tier: "basic", durationDays: 30 }],
        { tier: "basic", durationDays: 30 },
      ),
    ).toThrow();
    try {
      assertUniqueTierDuration(
        [{ _id: "v1", tier: "basic", durationDays: 30 }],
        { tier: "basic", durationDays: 30 },
      );
      throw new Error("expected error");
    } catch (error) {
      expect(getErrorCode(error)).toBe("duplicate_tier_duration_variant");
    }
  });

  it("rejects missing or disabled linked policies", () => {
    expect(() => assertLinkedPolicyEnabled(null)).toThrow();
    expect(() => assertLinkedPolicyEnabled({ enabled: false })).toThrow();

    try {
      assertLinkedPolicyEnabled(null);
      throw new Error("expected error");
    } catch (error) {
      expect(getErrorCode(error)).toBe("policy_link_required");
    }

    try {
      assertLinkedPolicyEnabled({ enabled: false });
      throw new Error("expected error");
    } catch (error) {
      expect(getErrorCode(error)).toBe("policy_link_disabled");
    }
  });
});
