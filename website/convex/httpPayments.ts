import { anyApi } from "convex/server";
import type { HttpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { sha256Hex } from "./connectorsAuth";
import { getCorrelationId, jsonError, jsonResponse } from "./httpHelpers";
import {
  extractSellWebhookEventMeta,
  readSellWebhookSignature,
  verifySellWebhookSignature,
} from "./paymentsUtils";

const PROVIDER = "sellapp";

function readReplayToken(request: Request): string | null {
  const fromHeader = request.headers.get("x-replay-token");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();

  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = /^\s*bearer\s+(.+?)\s*$/i.exec(authorization);
  if (!match?.[1]) return null;
  return match[1].trim() || null;
}

function readFallbackEventId(request: Request): string | null {
  const candidates = [
    request.headers.get("x-sellapp-event-id"),
    request.headers.get("x-event-id"),
    request.headers.get("x-webhook-id"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

async function parseJsonBody(
  request: Request,
): Promise<{ rawBody: string; body: unknown } | { error: "invalid_json"; rawBody: string }> {
  const rawBody = await request.text();
  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    return { rawBody, body };
  } catch {
    return { error: "invalid_json", rawBody };
  }
}

export function mountPaymentRoutes(http: HttpRouter) {
  http.route({
    path: "/webhooks/sellapp",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const correlationId = getCorrelationId(request);
      const parsed = await parseJsonBody(request);
      if ("error" in parsed) {
        return jsonError({
          status: 400,
          correlationId,
          errorCode: "bad_request",
          message: "Invalid JSON",
        });
      }

      const sellSecret = process.env.SELLAPP_WEBHOOK_SECRET?.trim() ?? "";
      if (sellSecret) {
        const signatureHeader = readSellWebhookSignature(request.headers);
        if (!signatureHeader) {
          return jsonError({
            status: 401,
            correlationId,
            errorCode: "unauthorized",
            message: "Missing webhook signature",
          });
        }

        const valid = await verifySellWebhookSignature({
          secret: sellSecret,
          payload: parsed.rawBody,
          signatureHeader,
        });
        if (!valid) {
          return jsonError({
            status: 401,
            correlationId,
            errorCode: "unauthorized",
            message: "Invalid webhook signature",
          });
        }
      } else {
        console.warn("[payments] SELLAPP_WEBHOOK_SECRET is not set; webhook signature checks disabled");
      }

      const fallbackEventId = readFallbackEventId(request);
      const eventMeta = extractSellWebhookEventMeta(parsed.body, fallbackEventId);
      if (!eventMeta.eventId) {
        return jsonError({
          status: 400,
          correlationId,
          errorCode: "bad_request",
          message: "Missing event id",
        });
      }

      const internal = anyApi as any;
      const payloadHash = await sha256Hex(parsed.rawBody || JSON.stringify(parsed.body));

      const upsert = await ctx.runMutation(internal.payments.upsertSellWebhookEvent, {
        provider: PROVIDER,
        eventId: eventMeta.eventId,
        eventType: eventMeta.eventType,
        payload: parsed.body,
        payloadHash,
        receivedAt: Date.now(),
      });

      if (!upsert.created && upsert.status === "processed") {
        return jsonResponse({
          ok: true,
          event_id: eventMeta.eventId,
          deduped: true,
          correlation_id: correlationId,
        });
      }

      const processed = await ctx.runMutation(internal.payments.processSellWebhookEvent, {
        provider: PROVIDER,
        eventId: eventMeta.eventId,
        attemptedAt: Date.now(),
      });
      if (!processed.ok) {
        console.error(
          `[payments] webhook processing failed event=${eventMeta.eventId} error=${processed.error}`,
        );
        return jsonError({
          status: 500,
          correlationId,
          errorCode: "processing_failed",
          message: "Webhook processing failed",
        });
      }

      return jsonResponse({
        ok: true,
        event_id: eventMeta.eventId,
        deduped: processed.deduped,
        subscription_status: processed.subscriptionStatus,
        correlation_id: correlationId,
      });
    }),
  });

  http.route({
    path: "/webhooks/sellapp/replay",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const correlationId = getCorrelationId(request);
      const configuredReplayToken = process.env.SELLAPP_REPLAY_TOKEN?.trim() ?? "";
      if (!configuredReplayToken) {
        return jsonError({
          status: 503,
          correlationId,
          errorCode: "not_configured",
          message: "SELLAPP_REPLAY_TOKEN is not configured",
        });
      }

      const replayToken = readReplayToken(request);
      if (!replayToken || replayToken !== configuredReplayToken) {
        return jsonError({
          status: 401,
          correlationId,
          errorCode: "unauthorized",
          message: "Invalid replay token",
        });
      }

      const parsed = await parseJsonBody(request);
      if ("error" in parsed) {
        return jsonError({
          status: 400,
          correlationId,
          errorCode: "bad_request",
          message: "Invalid JSON",
        });
      }

      if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
        return jsonError({
          status: 400,
          correlationId,
          errorCode: "bad_request",
          message: "Invalid body",
        });
      }

      const eventIdRaw = (parsed.body as Record<string, unknown>).event_id;
      const eventId = typeof eventIdRaw === "string" ? eventIdRaw.trim() : "";
      if (!eventId) {
        return jsonError({
          status: 400,
          correlationId,
          errorCode: "bad_request",
          message: "Missing event_id",
        });
      }

      const internal = anyApi as any;
      const processed = await ctx.runMutation(internal.payments.processSellWebhookEvent, {
        provider: PROVIDER,
        eventId,
        attemptedAt: Date.now(),
      });
      if (!processed.ok) {
        const status = processed.errorCode === "webhook_event_not_found" ? 404 : 500;
        console.error(`[payments] replay failed event=${eventId} error=${processed.error}`);
        return jsonError({
          status,
          correlationId,
          errorCode:
            processed.errorCode === "webhook_event_not_found"
              ? "not_found"
              : "processing_failed",
          message:
            processed.errorCode === "webhook_event_not_found"
              ? "Webhook event not found"
              : "Replay failed",
        });
      }

      return jsonResponse({
        ok: true,
        replayed: true,
        event_id: eventId,
        deduped: processed.deduped,
        subscription_status: processed.subscriptionStatus,
        correlation_id: correlationId,
      });
    }),
  });

  http.route({
    path: "/webhooks/sellapp/failures",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const correlationId = getCorrelationId(request);
      const configuredReplayToken = process.env.SELLAPP_REPLAY_TOKEN?.trim() ?? "";
      if (!configuredReplayToken) {
        return jsonError({
          status: 503,
          correlationId,
          errorCode: "not_configured",
          message: "SELLAPP_REPLAY_TOKEN is not configured",
        });
      }

      const replayToken = readReplayToken(request);
      if (!replayToken || replayToken !== configuredReplayToken) {
        return jsonError({
          status: 401,
          correlationId,
          errorCode: "unauthorized",
          message: "Invalid replay token",
        });
      }

      const url = new URL(request.url);
      const limitRaw = url.searchParams.get("limit");
      const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
      const limit =
        typeof parsedLimit === "number" && Number.isFinite(parsedLimit)
          ? Math.max(1, Math.min(200, parsedLimit))
          : undefined;

      const internal = anyApi as any;
      const failures = await ctx.runQuery(internal.payments.listFailedSellWebhookEvents, {
        provider: PROVIDER,
        limit,
      });

      return jsonResponse({
        ok: true,
        failures,
        correlation_id: correlationId,
      });
    }),
  });
}
