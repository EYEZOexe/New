export type SubscriptionStatus = "active" | "inactive" | "canceled" | "past_due";

type EventMeta = {
  eventId: string | null;
  eventType: string;
};

export type SellWebhookProjection = EventMeta & {
  customerEmail: string | null;
  productId: string | null;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  rawStatus: string | null;
  subscriptionStatus: SubscriptionStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPath(payload: unknown, path: string): unknown {
  const parts = path.split(".");
  let cursor: unknown = payload;
  for (const part of parts) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function coerceString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readFirstString(payload: unknown, paths: readonly string[]): string | null {
  for (const path of paths) {
    const value = coerceString(readPath(payload, path));
    if (value) return value;
  }
  return null;
}

const EVENT_ID_PATHS = [
  "event_id",
  "id",
  "event.id",
  "event.data.id",
  "data.event_id",
  "data.id",
  "webhook.id",
] as const;

const EVENT_TYPE_PATHS = [
  "event_type",
  "event",
  "type",
  "event.type",
  "data.event_type",
  "data.type",
] as const;

const CUSTOMER_EMAIL_PATHS = [
  "customer_email",
  "email",
  "customer.email",
  "buyer.email",
  "data.customer_email",
  "data.email",
  "data.customer.email",
  "data.buyer.email",
] as const;

const PRODUCT_ID_PATHS = [
  "product_id",
  "product.id",
  "data.product_id",
  "data.product.id",
] as const;

const CUSTOMER_ID_PATHS = [
  "customer_id",
  "customer.id",
  "buyer.id",
  "data.customer_id",
  "data.customer.id",
  "data.buyer.id",
] as const;

const SUBSCRIPTION_ID_PATHS = [
  "subscription_id",
  "subscription.id",
  "data.subscription_id",
  "data.subscription.id",
] as const;

const STATUS_PATHS = [
  "subscription_status",
  "status",
  "payment_status",
  "data.subscription_status",
  "data.status",
  "data.payment_status",
] as const;

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function includesOneOf(source: string, needles: readonly string[]): boolean {
  return needles.some((needle) => source.includes(needle));
}

export function mapSellLifecycleToSubscriptionStatus(args: {
  eventType?: string | null;
  rawStatus?: string | null;
}): SubscriptionStatus {
  const status = (args.rawStatus ?? "").trim().toLowerCase();
  const eventType = (args.eventType ?? "").trim().toLowerCase();
  const source = `${status} ${eventType}`.trim();

  if (!source) return "inactive";

  if (
    includesOneOf(source, [
      "chargeback",
      "refund",
      "cancel",
      "canceled",
      "cancelled",
      "revoked",
      "revoke",
    ])
  ) {
    return "canceled";
  }

  if (
    includesOneOf(source, [
      "past_due",
      "past due",
      "payment_failed",
      "failed",
      "overdue",
      "unpaid",
    ])
  ) {
    return "past_due";
  }

  if (
    includesOneOf(source, [
      "active",
      "paid",
      "purchase",
      "completed",
      "renew",
      "success",
      "trialing",
      "trial_started",
    ])
  ) {
    return "active";
  }

  if (includesOneOf(source, ["expired", "inactive", "ended", "disabled"])) {
    return "inactive";
  }

  // Fail-closed so access is not granted for unknown provider states.
  return "inactive";
}

export function extractSellWebhookEventMeta(
  payload: unknown,
  fallbackEventId?: string | null,
): EventMeta {
  const eventIdFromPayload = readFirstString(payload, EVENT_ID_PATHS);
  const fallback = coerceString(fallbackEventId ?? null);
  const eventType = readFirstString(payload, EVENT_TYPE_PATHS) ?? "unknown";

  return {
    eventId: eventIdFromPayload ?? fallback,
    eventType,
  };
}

export function projectSellWebhookPayload(
  payload: unknown,
  fallbackEventId?: string | null,
): SellWebhookProjection {
  const { eventId, eventType } = extractSellWebhookEventMeta(payload, fallbackEventId);
  const rawStatus = readFirstString(payload, STATUS_PATHS);

  return {
    eventId,
    eventType,
    customerEmail: normalizeEmail(readFirstString(payload, CUSTOMER_EMAIL_PATHS)),
    productId: readFirstString(payload, PRODUCT_ID_PATHS),
    externalCustomerId: readFirstString(payload, CUSTOMER_ID_PATHS),
    externalSubscriptionId: readFirstString(payload, SUBSCRIPTION_ID_PATHS),
    rawStatus,
    subscriptionStatus: mapSellLifecycleToSubscriptionStatus({
      eventType,
      rawStatus,
    }),
  };
}

function normalizeHex(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const withoutPrefix = normalized.startsWith("sha256=")
    ? normalized.slice("sha256=".length)
    : normalized;
  return /^[a-f0-9]+$/.test(withoutPrefix) ? withoutPrefix : null;
}

function normalizeBase64(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function readSellWebhookSignature(headers: Headers): string | null {
  const candidates = [
    headers.get("x-sellapp-signature"),
    headers.get("x-sellapp-hmac-sha256"),
    headers.get("x-signature"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

export async function verifySellWebhookSignature(args: {
  secret: string;
  payload: string;
  signatureHeader: string;
}): Promise<boolean> {
  const secret = args.secret.trim();
  if (!secret) return false;

  const providedCandidates = args.signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (providedCandidates.length === 0) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(args.payload)),
  );
  const expectedHex = bytesToHex(digest);
  const expectedBase64 = bytesToBase64(digest);

  for (const candidate of providedCandidates) {
    const asHex = normalizeHex(candidate);
    if (asHex && constantTimeEquals(asHex, expectedHex)) {
      return true;
    }

    const asBase64 = normalizeBase64(candidate);
    if (asBase64 && constantTimeEquals(asBase64, expectedBase64)) {
      return true;
    }
  }

  return false;
}
