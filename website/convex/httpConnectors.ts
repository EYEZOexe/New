import type { HttpRouter } from "convex/server";
import { anyApi } from "convex/server";
import { httpAction } from "./_generated/server";

import { computeConnectorTokenHashFromRequest } from "./connectorsAuth";
import { getCorrelationId, jsonError, jsonResponse } from "./httpHelpers";

function buildConfigEtag(configVersion: number) {
  return `W/\"${configVersion}\"`;
}

export function mountConnectorRoutes(http: HttpRouter) {
  http.route({
    pathPrefix: "/connectors/",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const correlationId = getCorrelationId(request);
      const url = new URL(request.url);

      // /connectors/<connectorId>/runtime-config
      const prefix = "/connectors/";
      const rest = url.pathname.startsWith(prefix)
        ? url.pathname.slice(prefix.length)
        : "";
      const [connectorId, subpath, extra] = rest.split("/");

      if (!connectorId || subpath !== "runtime-config" || extra) {
        return new Response("Not Found", { status: 404 });
      }

      const tenantKey = url.searchParams.get("tenant_key") ?? "";
      if (!tenantKey) {
        return jsonError({
          status: 400,
          correlationId,
          errorCode: "bad_request",
          message: "Missing tenant_key",
        });
      }

      const tokenHash = await computeConnectorTokenHashFromRequest(request);
      if (!tokenHash) {
        return jsonError({
          status: 401,
          correlationId,
          errorCode: "unauthorized",
          message: "Missing bearer token",
        });
      }

      // NOTE: We use `anyApi` to avoid requiring codegen in this repo/worktree.
      const internal = anyApi as any;

      const connector = await ctx.runQuery(internal.connectorsInternal.getConnectorByTokenHash, {
        tokenHash,
      });

      if (!connector) {
        return jsonError({
          status: 401,
          correlationId,
          errorCode: "unauthorized",
          message: "Invalid token",
        });
      }

      if (connector.tenantKey !== tenantKey || connector.connectorId !== connectorId) {
        return jsonError({
          status: 403,
          correlationId,
          errorCode: "forbidden",
          message: "Token does not match connector scope",
        });
      }

      const runtime = await ctx.runQuery(internal.connectorsInternal.getRuntimeConfig, {
        tenantKey,
        connectorId,
      });

      if (!runtime) {
        return jsonError({
          status: 404,
          correlationId,
          errorCode: "not_found",
          message: "Connector not found",
        });
      }

      const etag = buildConfigEtag(runtime.connector.configVersion);
      const ifNoneMatch = request.headers.get("if-none-match");
      if (ifNoneMatch && ifNoneMatch.trim() === etag) {
        await ctx.runMutation(internal.connectorsInternal.touchConnectorLastSeen, {
          tenantKey,
          connectorId,
          now: Date.now(),
        });
        return new Response(null, { status: 304, headers: { etag } });
      }

      await ctx.runMutation(internal.connectorsInternal.touchConnectorLastSeen, {
        tenantKey,
        connectorId,
        now: Date.now(),
      });

      return jsonResponse(
        {
          ok: true,
          config: {
            connector_id: runtime.connector.connectorId,
            tenant_key: runtime.connector.tenantKey,
            status: runtime.connector.status === "active" ? "active" : "paused",
            config_version: runtime.connector.configVersion,
            ingest_enabled: runtime.connector.status === "active",
            forward_enabled: false,
            sources: runtime.sources,
            mappings: runtime.mappings ?? [],
          },
          correlation_id: correlationId,
        },
        { status: 200, headers: { etag } },
      );
    }),
  });
}
