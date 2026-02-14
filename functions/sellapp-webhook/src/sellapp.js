import crypto from "node:crypto";

export function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqualHex(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifySellappSignature({ secret, bodyText, signatureHeader }) {
  const computed = hmacSha256Hex(secret, bodyText ?? "");
  return timingSafeEqualHex(computed, signatureHeader ?? "");
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function pickEmail(payload) {
  const candidates = [
    payload?.data?.email,
    payload?.data?.customer?.email,
    payload?.data?.order?.email,
    payload?.data?.order?.customer_email,
    payload?.data?.billing?.email,
    payload?.customer?.email,
    payload?.order?.email
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c.trim().toLowerCase();
  }
  return null;
}

export function mapSellappEventToAction(event) {
  if (event === "order.completed") return { subscriptionStatus: "active", teamAction: "grant" };
  if (event === "order.disputed") return { subscriptionStatus: "inactive", teamAction: "revoke" };
  return { subscriptionStatus: null, teamAction: null };
}

