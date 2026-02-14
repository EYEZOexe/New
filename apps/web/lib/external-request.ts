export type ExternalOriginInfo = {
  proto: "http" | "https";
  hostHeader: string;
  host: string;
  origin: string;
  warnings: string[];
  raw: {
    host: string | null;
    forwardedHost: string | null;
    forwardedProto: string | null;
    forwardedScheme: string | null;
  };
};

function firstCsvValue(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0]!.trim();
}

function stripPort(hostHeader: string): string {
  // IPv6 host headers are like: [::1]:3000. Leave bracketed hosts intact.
  if (hostHeader.startsWith("[")) return hostHeader;
  return hostHeader.split(":")[0] ?? hostHeader;
}

function normalizeProto(value: string | null): "http" | "https" | "" {
  const v = firstCsvValue(value).toLowerCase();
  if (v === "http" || v === "https") return v;
  return "";
}

export function getExternalOriginFromHeaders(h: Headers, nodeEnv?: string): ExternalOriginInfo {
  const warnings: string[] = [];

  const rawHost = h.get("host");
  const rawForwardedHost = h.get("x-forwarded-host");
  const rawForwardedProto = h.get("x-forwarded-proto");
  const rawForwardedScheme = h.get("x-forwarded-scheme");

  const hostHeader = firstCsvValue(rawForwardedHost) || firstCsvValue(rawHost);
  const host = stripPort(hostHeader);

  const protoFromHeaders =
    normalizeProto(rawForwardedProto) || normalizeProto(rawForwardedScheme) || "";

  let proto: "http" | "https";
  if (protoFromHeaders) {
    proto = protoFromHeaders;
  } else {
    proto = nodeEnv === "production" ? "https" : "http";
    warnings.push("missing_forwarded_proto");
  }

  // Some proxy chains incorrectly pass through "http" even for external HTTPS.
  if (nodeEnv === "production" && proto === "http") {
    proto = "https";
    warnings.push("forced_https_in_production");
  }

  return {
    proto,
    hostHeader,
    host,
    origin: `${proto}://${hostHeader}`,
    warnings,
    raw: {
      host: rawHost,
      forwardedHost: rawForwardedHost,
      forwardedProto: rawForwardedProto,
      forwardedScheme: rawForwardedScheme
    }
  };
}

