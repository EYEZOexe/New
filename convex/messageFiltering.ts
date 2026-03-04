type MessageFilteringRules = {
  blockedDomains: string[];
  allowedDomains: string[];
  blockedKeywords: string[];
  allowedKeywords: string[];
};

type MessageFilteringResult = {
  content: string;
  removedKeywordMatches: number;
  removedUrlCount: number;
  rules: MessageFilteringRules;
};

const URL_TOKEN_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTokenList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const token = item.trim();
    if (!token) continue;
    const dedupeKey = token.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push(token);
  }
  return normalized;
}

function normalizeKeyword(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDomain(value: string): string | null {
  let normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      normalized = new URL(normalized).hostname;
    } catch {
      return null;
    }
  }

  normalized = normalized.replace(/^\*\./, "").replace(/^www\./, "");
  normalized = normalized.split("/", 1)[0] ?? "";
  normalized = normalized.split(":", 1)[0] ?? "";
  normalized = normalized.replace(/\.+$/, "");

  if (!normalized) return null;
  if (!/^[a-z0-9.-]+$/.test(normalized)) return null;
  return normalized;
}

function normalizeUrlToken(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/[),.;!?]+$/g, "");
}

function extractDomainFromUrlToken(token: string): string | null {
  const normalizedToken = normalizeUrlToken(token);
  if (!normalizedToken) return null;

  const withProtocol = normalizedToken.startsWith("www.")
    ? `https://${normalizedToken}`
    : normalizedToken;
  try {
    const hostname = new URL(withProtocol).hostname.toLowerCase();
    const normalized = normalizeDomain(hostname);
    return normalized;
  } catch {
    return null;
  }
}

function domainMatches(domain: string, candidate: string): boolean {
  return domain === candidate || domain.endsWith(`.${candidate}`);
}

export function parseMessageFilteringRules(raw: unknown): MessageFilteringRules {
  const source = isRecord(raw) ? raw : {};

  const blockedDomains = parseTokenList(source.blockedDomains)
    .map(normalizeDomain)
    .filter((value): value is string => value !== null);
  const allowedDomains = parseTokenList(source.allowedDomains)
    .map(normalizeDomain)
    .filter((value): value is string => value !== null);
  const blockedKeywords = parseTokenList(source.blockedKeywords)
    .map(normalizeKeyword)
    .filter((value): value is string => value !== null);
  const allowedKeywords = parseTokenList(source.allowedKeywords)
    .map(normalizeKeyword)
    .filter((value): value is string => value !== null);

  return {
    blockedDomains,
    allowedDomains,
    blockedKeywords,
    allowedKeywords,
  };
}

export function applyMessageFiltering(content: string, rawRules: unknown): MessageFilteringResult {
  const rules = parseMessageFilteringRules(rawRules);
  const allowedDomains = new Set(rules.allowedDomains);
  const blockedDomains = new Set(rules.blockedDomains);
  const allowedKeywords = new Set(rules.allowedKeywords);
  const activeBlockedKeywords = rules.blockedKeywords.filter(
    (keyword) => !allowedKeywords.has(keyword),
  );

  if (blockedDomains.size === 0 && activeBlockedKeywords.length === 0) {
    return {
      content,
      removedKeywordMatches: 0,
      removedUrlCount: 0,
      rules,
    };
  }

  let removedUrlCount = 0;
  let removedKeywordMatches = 0;

  let nextContent = content;
  if (blockedDomains.size > 0) {
    nextContent = nextContent.replace(URL_TOKEN_PATTERN, (token) => {
      const domain = extractDomainFromUrlToken(token);
      if (!domain) return token;

      for (const allowed of allowedDomains.values()) {
        if (domainMatches(domain, allowed)) {
          return token;
        }
      }

      for (const blocked of blockedDomains.values()) {
        if (domainMatches(domain, blocked)) {
          removedUrlCount += 1;
          return "";
        }
      }

      return token;
    });
  }

  const blockedKeywords = [...activeBlockedKeywords].sort((a, b) => b.length - a.length);

  for (const keyword of blockedKeywords) {
    const escaped = escapeRegex(keyword);
    const useWordBoundary = /^[a-z0-9_]+$/i.test(keyword);
    const pattern = useWordBoundary
      ? new RegExp(`\\b${escaped}\\b`, "gi")
      : new RegExp(escaped, "gi");
    nextContent = nextContent.replace(pattern, () => {
      removedKeywordMatches += 1;
      return "";
    });
  }

  return {
    content: normalizeWhitespace(nextContent),
    removedKeywordMatches,
    removedUrlCount,
    rules,
  };
}
