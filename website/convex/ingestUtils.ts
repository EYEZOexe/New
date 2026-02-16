type IngestAttachment = {
  filename: string;
  source_url: string;
  size: number;
  content_type?: string | null;
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
};

type IngestNormalizationOptions = {
  receivedAt?: number;
};

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
    url: string;
    name?: string;
    contentType?: string;
    size?: number;
  }>;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
} {
  const attachments = (event.attachments ?? []).map((a) => ({
    url: a.source_url ?? "",
    ...(a.filename ? { name: a.filename } : {}),
    ...(a.content_type ? { contentType: a.content_type } : {}),
    ...(typeof a.size === "number" ? { size: a.size } : {}),
  }));

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
    content: event.content_clean ?? "",
    attachments,
    createdAt: parseIsoToMs(event.created_at),
    ...(editedAt ? { editedAt } : {}),
    ...(deletedAt ? { deletedAt } : {}),
  };
}
