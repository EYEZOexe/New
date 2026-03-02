import type { HttpRouter } from "convex/server";
import { anyApi } from "convex/server";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

import { computeConnectorTokenHashFromRequest } from "./connectorsAuth";
import { getCorrelationId, jsonError, jsonResponse } from "./httpHelpers";

async function authenticateConnector(ctx: ActionCtx, request: Request) {
  const correlationId = getCorrelationId(request);
  const tokenHash = await computeConnectorTokenHashFromRequest(request);
  if (!tokenHash) {
    return {
      ok: false as const,
      response: jsonError({
        status: 401,
        correlationId,
        errorCode: "unauthorized",
        message: "Missing bearer token",
      }),
    };
  }

  // NOTE: We use `anyApi` to avoid requiring codegen in this repo/worktree.
  const internal = anyApi as any;

  const connector = await ctx.runQuery(internal.connectorsInternal.getConnectorByTokenHash, {
    tokenHash,
  });

  if (!connector) {
    return {
      ok: false as const,
      response: jsonError({
        status: 401,
        correlationId,
        errorCode: "unauthorized",
        message: "Invalid token",
      }),
    };
  }

  if (connector.status !== "active") {
    return {
      ok: false as const,
      response: jsonError({
        status: 403,
        correlationId,
        errorCode: "connector_paused",
        message: "Connector is paused",
      }),
    };
  }

  return { ok: true as const, correlationId, connector };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type InlineHydrationCandidate = {
  tenantKey: string;
  connectorId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  receivedAt: number;
  attachments: Array<{
    attachmentId?: string;
    url: string;
    name?: string;
    contentType?: string;
    size?: number;
  }>;
};

const INLINE_HYDRATION_CONCURRENCY = 4;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function isLikelyImageAttachment(url: string, contentType?: string): boolean {
  const normalizedType = contentType?.trim().toLowerCase() ?? "";
  if (normalizedType.startsWith("image/")) {
    return true;
  }
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".bmp")
  );
}

function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildInlineHydrationCandidates(args: {
  tenantKey: string;
  connectorId: string;
  messages: unknown[];
  receivedAt: number;
}): InlineHydrationCandidate[] {
  const candidates: InlineHydrationCandidate[] = [];

  for (const message of args.messages) {
    if (!isObject(message)) continue;
    const eventType = normalizeString(message.event_type);
    if (eventType === "delete") continue;

    const sourceMessageId = normalizeString(message.discord_message_id);
    const sourceChannelId = normalizeString(message.discord_channel_id);
    if (!sourceMessageId || !sourceChannelId) continue;

    const rawAttachments = Array.isArray(message.attachments)
      ? message.attachments
      : [];
    const attachments: InlineHydrationCandidate["attachments"] = [];
    for (const rawAttachment of rawAttachments) {
      if (!isObject(rawAttachment)) continue;
      const url = normalizeString(rawAttachment.source_url);
      if (!isHttpUrl(url)) continue;

      const contentType = normalizeString(rawAttachment.content_type).toLowerCase();
      if (!isLikelyImageAttachment(url, contentType || undefined)) continue;

      const attachmentId = normalizeString(rawAttachment.discord_attachment_id);
      const name = normalizeString(rawAttachment.filename);
      const size = toFiniteNumber(rawAttachment.size);

      attachments.push({
        ...(attachmentId ? { attachmentId } : {}),
        url,
        ...(name ? { name } : {}),
        ...(contentType ? { contentType } : {}),
        ...(typeof size === "number" ? { size } : {}),
      });
    }

    if (attachments.length === 0) continue;

    candidates.push({
      tenantKey: args.tenantKey,
      connectorId: args.connectorId,
      sourceMessageId,
      sourceChannelId,
      receivedAt: args.receivedAt,
      attachments,
    });
  }

  return candidates;
}

export function mountIngestRoutes(http: HttpRouter) {
  http.route({
    path: "/ingest/message-batch",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const auth = await authenticateConnector(ctx, request);
      if (!auth.ok) return auth.response;

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid JSON",
        });
      }

      if (!isObject(body)) {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid body",
        });
      }

      const tenantKey = String(body.tenant_key ?? "");
      const connectorId = String(body.connector_id ?? "");
      const messages = (body.messages as unknown) ?? [];

      if (!tenantKey || !connectorId || !Array.isArray(messages)) {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Missing tenant_key/connector_id/messages",
        });
      }

      if (tenantKey !== auth.connector.tenantKey || connectorId !== auth.connector.connectorId) {
        return jsonError({
          status: 403,
          correlationId: auth.correlationId,
          errorCode: "forbidden",
          message: "Token does not match connector scope",
        });
      }

      const internal = anyApi as any;
      const receivedAt = Date.now();
      let result: { accepted: number; deduped: number; ignored?: number };
      try {
        result = await ctx.runMutation(internal.ingest.ingestMessageBatch, {
          tenantKey,
          connectorId,
          // Untrusted boundary (HTTP); internal mutation enforces runtime validation.
          messages: messages as any,
          receivedAt,
        });
      } catch (error) {
        console.error("[ingest/message-batch] Validation or mutation error:", String(error));
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid message batch payload",
        });
      }

      let inlineHydrationRequested = 0;
      let inlineHydrationCompleted = 0;
      let inlineHydrationFailed = 0;
      let inlineHydrationFallbackScheduled = 0;
      if (auth.connector.forwardEnabled === true) {
        const hydrationCandidates = buildInlineHydrationCandidates({
          tenantKey,
          connectorId,
          messages,
          receivedAt,
        });
        inlineHydrationRequested = hydrationCandidates.length;
        if (hydrationCandidates.length > 0) {
          const startedAt = Date.now();
          for (
            let index = 0;
            index < hydrationCandidates.length;
            index += INLINE_HYDRATION_CONCURRENCY
          ) {
            const batch = hydrationCandidates.slice(
              index,
              index + INLINE_HYDRATION_CONCURRENCY,
            );
            const settled = await Promise.allSettled(
              batch.map((candidate) =>
                ctx.runAction(internal.mirrorMedia.hydrateSignalMediaForMessage, candidate),
              ),
            );

            for (let offset = 0; offset < settled.length; offset += 1) {
              const outcome = settled[offset];
              const candidate = batch[offset];
              if (outcome.status === "fulfilled") {
                inlineHydrationCompleted += 1;
                continue;
              }

              inlineHydrationFailed += 1;
              console.warn(
                `[ingest/message-batch] inline hydration failed message=${candidate.sourceMessageId} channel=${candidate.sourceChannelId} reason=${String(outcome.reason)}`,
              );
              await ctx.scheduler.runAfter(
                0,
                internal.mirrorMedia.hydrateSignalMediaForMessage,
                candidate,
              );
              inlineHydrationFallbackScheduled += 1;
            }
          }
          const elapsedMs = Date.now() - startedAt;
          console.info(
            `[ingest/message-batch] inline hydration tenant=${tenantKey} connector=${connectorId} requested=${inlineHydrationRequested} completed=${inlineHydrationCompleted} failed=${inlineHydrationFailed} fallback_scheduled=${inlineHydrationFallbackScheduled} elapsed_ms=${elapsedMs}`,
          );
        }
      }

      await ctx.runMutation(internal.connectorsInternal.touchConnectorLastSeen, {
        tenantKey,
        connectorId,
        now: receivedAt,
      });

      return jsonResponse({
        ok: true,
        accepted: result.accepted,
        deduped: result.deduped,
        ignored: result.ignored ?? 0,
        correlation_id: auth.correlationId,
      });
    }),
  });

  http.route({
    path: "/ingest/channel-guild-sync",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const auth = await authenticateConnector(ctx, request);
      if (!auth.ok) return auth.response;

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid JSON",
        });
      }

      if (!isObject(body)) {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid body",
        });
      }

      const tenantKey = String(body.tenant_key ?? "");
      const connectorId = String(body.connector_id ?? "");
      const guilds = (body.guilds as unknown) ?? [];
      const channels = (body.channels as unknown) ?? [];

      if (!tenantKey || !connectorId || !Array.isArray(guilds) || !Array.isArray(channels)) {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Missing tenant_key/connector_id/guilds/channels",
        });
      }

      if (tenantKey !== auth.connector.tenantKey || connectorId !== auth.connector.connectorId) {
        return jsonError({
          status: 403,
          correlationId: auth.correlationId,
          errorCode: "forbidden",
          message: "Token does not match connector scope",
        });
      }

      try {
        const internal = anyApi as any;
        await ctx.runMutation(internal.ingest.ingestChannelGuildSync, {
          tenantKey,
          connectorId,
          // Untrusted boundary (HTTP); internal mutation enforces runtime validation.
          guilds: guilds as any,
          channels: channels as any,
          receivedAt: Date.now(),
        });
      } catch (error) {
        console.error("[ingest/channel-guild-sync] Validation or mutation error:", String(error));
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid channel/guild sync payload",
        });
      }

      const internal = anyApi as any;
      await ctx.runMutation(internal.connectorsInternal.touchConnectorLastSeen, {
        tenantKey,
        connectorId,
        now: Date.now(),
      });

      return jsonResponse({
        ok: true,
        correlation_id: auth.correlationId,
      });
    }),
  });

  http.route({
    path: "/ingest/thread",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const auth = await authenticateConnector(ctx, request);
      if (!auth.ok) return auth.response;

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid JSON",
        });
      }

      if (!isObject(body)) {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid body",
        });
      }

      const tenantKey = String(body.tenant_key ?? "");
      const connectorId = String(body.connector_id ?? "");

      if (!tenantKey || !connectorId) {
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Missing tenant_key/connector_id",
        });
      }

      if (tenantKey !== auth.connector.tenantKey || connectorId !== auth.connector.connectorId) {
        return jsonError({
          status: 403,
          correlationId: auth.correlationId,
          errorCode: "forbidden",
          message: "Token does not match connector scope",
        });
      }

      const event = {
        idempotency_key: body.idempotency_key,
        event_type: body.event_type,
        thread: body.thread,
        member_delta: body.member_delta,
      };

      try {
        const internal = anyApi as any;
        await ctx.runMutation(internal.ingest.ingestThread, {
          tenantKey,
          connectorId,
          // Untrusted boundary (HTTP); internal mutation enforces runtime validation.
          event: event as any,
          receivedAt: Date.now(),
        });
      } catch (error) {
        console.error("[ingest/thread] Validation or mutation error:", String(error));
        return jsonError({
          status: 400,
          correlationId: auth.correlationId,
          errorCode: "bad_request",
          message: "Invalid thread payload",
        });
      }

      const internal = anyApi as any;
      await ctx.runMutation(internal.connectorsInternal.touchConnectorLastSeen, {
        tenantKey,
        connectorId,
        now: Date.now(),
      });

      return jsonResponse({
        ok: true,
        correlation_id: auth.correlationId,
      });
    }),
  });
}
