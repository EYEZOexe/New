import crypto from "node:crypto";

export function makeOAuthState(): string {
  // 32 hex chars.
  return crypto.randomBytes(16).toString("hex");
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyOAuthState(expected: string, actual: string): boolean {
  return timingSafeEqualUtf8(expected ?? "", actual ?? "");
}

