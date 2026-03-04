import { isLikelyImageAttachment, normalizeContentType } from "./imageDetection";

type IngestAttachment = {
  discord_attachment_id: string;
  filename: string;
  source_url: string;
  size: number;
  content_type?: string | null;
};

type IngestEmbed = {
  embed_index?: number;
  embed_type?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  raw_json?: Record<string, unknown> | null;
};

type IngestMessageEvent = {
  event_type: "create" | "update" | "delete";
  discord_message_id: string;
  discord_channel_id: string;
  discord_guild_id: string;
  content_clean: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  attachments: IngestAttachment[];
  embeds?: IngestEmbed[];
};

type IngestNormalizationOptions = {
  receivedAt?: number;
};

const MAX_SYNTHETIC_EMBED_TEXT_LENGTH = 3900;

export function parseIsoToMs(value: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error("invalid_iso_timestamp");
  }
  return ms;
}

function parseOptionalIsoToMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

export function messageEventToSignalFields(
  event: IngestMessageEvent,
  scope: { tenantKey: string; connectorId: string },
  options?: IngestNormalizationOptions,
): {
  tenantKey: string;
  connectorId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceGuildId: string;
  content: string;
  attachments: Array<{
    attachmentId?: string;
    url: string;
    name?: string;
    contentType?: string;
    size?: number;
  }>;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
} {
  const attachmentUrls = new Set<string>();
  const directAttachments = (event.attachments ?? []).flatMap((a) => {
    const rawUrl = typeof a.source_url === "string" ? a.source_url.trim() : "";
    if (!isSafeAttachmentUrl(rawUrl)) {
      return [];
    }
    attachmentUrls.add(rawUrl);

    const rawName = typeof a.filename === "string" ? a.filename.trim() : "";
    const normalizedName =
      rawName.length > 180 ? rawName.slice(0, 180) : rawName;
    const rawContentType =
      typeof a.content_type === "string" ? a.content_type.trim() : "";
    const normalizedContentType = rawContentType
      ? rawContentType.toLowerCase()
      : "";
    const normalizedSize =
      typeof a.size === "number" && Number.isFinite(a.size) && a.size >= 0
        ? Math.floor(a.size)
        : undefined;
    const attachmentId =
      typeof a.discord_attachment_id === "string"
        ? a.discord_attachment_id.trim()
        : "";

    return [
      {
        ...(attachmentId ? { attachmentId } : {}),
        url: rawUrl,
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(normalizedContentType ? { contentType: normalizedContentType } : {}),
        ...(typeof normalizedSize === "number" ? { size: normalizedSize } : {}),
      },
    ];
  });
  const embedMediaAttachments = extractEmbedMediaAttachments(event.embeds, attachmentUrls);
  const attachments = [...directAttachments, ...embedMediaAttachments];
  const normalizedContent = typeof event.content_clean === "string" ? event.content_clean.trim() : "";
  const embedDerivedContent = extractEmbedTextContent(event.embeds);

  const editedAtFromPayload = parseOptionalIsoToMs(event.edited_at);
  const deletedAtFromPayload = parseOptionalIsoToMs(event.deleted_at);
  const receivedAt = options?.receivedAt;

  const editedAt =
    editedAtFromPayload ??
    (event.event_type === "update" && typeof receivedAt === "number" ? receivedAt : undefined);

  const deletedAt =
    deletedAtFromPayload ??
    (event.event_type === "delete"
      ? editedAtFromPayload ?? (typeof receivedAt === "number" ? receivedAt : undefined)
      : undefined);

  return {
    tenantKey: scope.tenantKey,
    connectorId: scope.connectorId,
    sourceMessageId: event.discord_message_id,
    sourceChannelId: event.discord_channel_id,
    sourceGuildId: event.discord_guild_id,
    content: normalizedContent || embedDerivedContent,
    attachments,
    createdAt: parseIsoToMs(event.created_at),
    ...(editedAt ? { editedAt } : {}),
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function isSafeAttachmentUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getFirstString(
  object: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
}

function pickMediaUrl(embed: Record<string, unknown>, key: string): string | null {
  const value = embed[key];
  if (!isRecord(value)) return null;
  return getFirstString(value, ["url", "proxy_url", "proxyUrl"]);
}

function extractEmbedMediaAttachments(
  embeds: IngestEmbed[] | undefined,
  existingUrls: Set<string>,
): Array<{
  attachmentId?: string;
  url: string;
  name?: string;
  contentType?: string;
}> {
  if (!Array.isArray(embeds) || embeds.length === 0) {
    return [];
  }

  const extracted: Array<{
    attachmentId?: string;
    url: string;
    name?: string;
    contentType?: string;
  }> = [];

  for (let index = 0; index < embeds.length; index += 1) {
    const embed = embeds[index];
    const raw = isRecord(embed?.raw_json) ? embed.raw_json : null;
    if (!raw) continue;

    const type = typeof embed?.embed_type === "string" ? embed.embed_type.trim().toLowerCase() : "";
    const title = typeof embed?.title === "string" ? embed.title.trim() : "";
    const contentType = normalizeContentType(
      getFirstString(raw, ["content_type", "contentType"]),
    );
    const mediaCandidates = [
      { slot: "image", url: pickMediaUrl(raw, "image") },
      { slot: "thumbnail", url: pickMediaUrl(raw, "thumbnail") },
      { slot: "video", url: pickMediaUrl(raw, "video") },
    ];

    for (const candidate of mediaCandidates) {
      const url = candidate.url?.trim() ?? "";
      if (!isSafeAttachmentUrl(url)) continue;
      if (
        !isLikelyImageAttachment({
          url,
          contentType: contentType || undefined,
        })
      ) {
        continue;
      }
      if (existingUrls.has(url)) continue;
      existingUrls.add(url);

      const attachmentId = `embed:${index}:${candidate.slot}`;
      const defaultName = type ? `${type}-${candidate.slot}` : `embed-${candidate.slot}`;
      extracted.push({
        attachmentId,
        url,
        name: title || defaultName,
        ...(contentType ? { contentType } : {}),
      });
    }
  }

  return extracted;
}

function getNestedRecord(
  object: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = object[key];
  return isRecord(value) ? value : null;
}

function pushEmbedTextSegment(
  segments: string[],
  seen: Set<string>,
  value: unknown,
) {
  if (typeof value !== "string") return;
  const normalized = value.trim();
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  segments.push(normalized);
}

function extractEmbedTextContent(embeds: IngestEmbed[] | undefined): string {
  if (!Array.isArray(embeds) || embeds.length === 0) {
    return "";
  }

  const segments: string[] = [];
  const seenSegments = new Set<string>();

  for (const embed of embeds) {
    if (!embed || typeof embed !== "object") continue;
    const raw = isRecord(embed.raw_json) ? embed.raw_json : null;

    pushEmbedTextSegment(segments, seenSegments, embed.title);
    pushEmbedTextSegment(segments, seenSegments, embed.description);

    if (raw) {
      pushEmbedTextSegment(segments, seenSegments, raw.title);
      pushEmbedTextSegment(segments, seenSegments, raw.description);
      pushEmbedTextSegment(segments, seenSegments, raw.url);

      const author = getNestedRecord(raw, "author");
      if (author) {
        pushEmbedTextSegment(segments, seenSegments, author.name);
      }

      const fields = raw.fields;
      if (Array.isArray(fields)) {
        for (const field of fields) {
          if (!isRecord(field)) continue;
          const name = typeof field.name === "string" ? field.name.trim() : "";
          const value = typeof field.value === "string" ? field.value.trim() : "";
          const combined = name && value ? `${name}: ${value}` : name || value;
          pushEmbedTextSegment(segments, seenSegments, combined);
        }
      }

      const footer = getNestedRecord(raw, "footer");
      if (footer) {
        pushEmbedTextSegment(segments, seenSegments, footer.text);
      }
    }
  }

  if (segments.length === 0) {
    return "";
  }

  const combined = segments.join("\n");
  return combined.length > MAX_SYNTHETIC_EMBED_TEXT_LENGTH
    ? combined.slice(0, MAX_SYNTHETIC_EMBED_TEXT_LENGTH)
    : combined;
}
