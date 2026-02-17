import { describe, expect, it } from "bun:test";

import {
  extractSellWebhookEventMeta,
  mapSellLifecycleToSubscriptionStatus,
  projectSellWebhookPayload,
  verifySellWebhookSignature,
} from "../../convex/paymentsUtils";

describe("paymentsUtils", () => {
  it("extracts event metadata with header fallback", () => {
    const payload = {
      data: {
        type: "order.completed",
      },
    };

    const meta = extractSellWebhookEventMeta(payload, "evt_from_header");
    expect(meta.eventId).toBe("evt_from_header");
    expect(meta.eventType).toBe("order.completed");
  });

  it("projects payload fields for subscription processing", () => {
    const payload = {
      event_id: "evt_123",
      event: "subscription.renewed",
      customer: { email: "USER@Example.com", id: "cus_1" },
      subscription: { id: "sub_1" },
      product: { id: "prod_1" },
      status: "paid",
    };

    const projected = projectSellWebhookPayload(payload);
    expect(projected.eventId).toBe("evt_123");
    expect(projected.eventType).toBe("subscription.renewed");
    expect(projected.customerEmail).toBe("user@example.com");
    expect(projected.externalCustomerId).toBe("cus_1");
    expect(projected.externalSubscriptionId).toBe("sub_1");
    expect(projected.productId).toBe("prod_1");
    expect(projected.subscriptionStatus).toBe("active");
  });

  it("maps failed lifecycle states to past_due", () => {
    expect(
      mapSellLifecycleToSubscriptionStatus({
        eventType: "invoice.payment_failed",
      }),
    ).toBe("past_due");
  });

  it("maps cancel lifecycle states to canceled", () => {
    expect(
      mapSellLifecycleToSubscriptionStatus({
        rawStatus: "canceled",
      }),
    ).toBe("canceled");
  });

  it("verifies HMAC signatures from sha256=hex format", async () => {
    const secret = "super-secret";
    const payload = JSON.stringify({ event_id: "evt_1", status: "paid" });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const digest = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
    );
    const hex = Array.from(digest)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const valid = await verifySellWebhookSignature({
      secret,
      payload,
      signatureHeader: `sha256=${hex}`,
    });
    expect(valid).toBe(true);
  });
});
