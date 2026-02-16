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
      let result: { accepted: number; deduped: number; ignored?: number };
      try {
        result = await ctx.runMutation(internal.ingest.ingestMessageBatch, {
          tenantKey,
          connectorId,
          // Untrusted boundary (HTTP); internal mutation enforces runtime validation.
          messages: messages as any,
          receivedAt: Date.now(),
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

      await ctx.runMutation(internal.connectorsInternal.touchConnectorLastSeen, {
        tenantKey,
        connectorId,
        now: Date.now(),
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
