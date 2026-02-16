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

export function parseIsoToMs(value: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error("invalid_iso_timestamp");
  }
  return ms;
}

export function messageEventToSignalFields(
  event: IngestMessageEvent,
  scope: { tenantKey: string; connectorId: string },
): {
  tenantKey: string;
  connectorId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceGuildId: string;
  content: string;
  attachments?: Array<{
    url: string;
    name?: string;
    contentType?: string;
    size?: number;
  }>;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
} {
  const attachments =
    event.attachments?.length > 0
      ? event.attachments.map((a) => ({
          url: a.source_url ?? "",
          ...(a.filename ? { name: a.filename } : {}),
          ...(a.content_type ? { contentType: a.content_type } : {}),
          ...(typeof a.size === "number" ? { size: a.size } : {}),
        }))
      : undefined;

  const editedAt = event.edited_at ? parseIsoToMs(event.edited_at) : undefined;
  const deletedAt = event.deleted_at ? parseIsoToMs(event.deleted_at) : undefined;

  return {
    tenantKey: scope.tenantKey,
    connectorId: scope.connectorId,
    sourceMessageId: event.discord_message_id,
    sourceChannelId: event.discord_channel_id,
    sourceGuildId: event.discord_guild_id,
    content: event.content_clean ?? "",
    ...(attachments ? { attachments } : {}),
    createdAt: parseIsoToMs(event.created_at),
    ...(editedAt ? { editedAt } : {}),
    ...(deletedAt ? { deletedAt } : {}),
  };
}
