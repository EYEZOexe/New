export type ConnectorTransportConfig = {
    ingestBaseUrl: string;
    connectorId: string;
    tenantKey: string;
    connectorToken: string;
    requestTimeoutMs?: number;
    maxBatchSize?: number;
};

export type RuntimeConfigSource = {
    guild_id: string;
    channel_id: string;
    thread_mode?: "include" | "exclude" | "only";
    is_enabled?: boolean;
};

export type RuntimeConfigMapping = {
    source_channel_id: string;
    target_channel_id: string;
    filters_json?: Record<string, unknown>;
    transform_json?: Record<string, unknown>;
    priority?: number;
};

export type ConnectorRuntimeConfig = {
    connector_id: string;
    tenant_key: string;
    status: "active" | "paused";
    config_version?: number;
    ingest_enabled?: boolean;
    forward_enabled?: boolean;
    sources: RuntimeConfigSource[];
    mappings?: RuntimeConfigMapping[];
};

export type IngestAttachment = {
    discord_attachment_id: string;
    filename: string;
    source_url: string;
    size: number;
    content_type?: string | null;
};

export type IngestEmbed = {
    embed_index: number;
    embed_type?: string | null;
    title?: string | null;
    description?: string | null;
    url?: string | null;
    raw_json: Record<string, unknown>;
};

export type IngestMessageEventType = "create" | "update" | "delete";

export type IngestMessageEvent = {
    idempotency_key: string;
    event_type: IngestMessageEventType;
    discord_message_id: string;
    discord_guild_id: string;
    discord_channel_id: string;
    discord_thread_id?: string | null;
    discord_author_id?: string | null;
    author_username?: string | null;
    author_global_name?: string | null;
    content_raw: string;
    content_clean: string;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    attachments: IngestAttachment[];
    embeds: IngestEmbed[];
    mentioned_role_ids?: string[];
    mentioned_user_ids?: string[];
};

export type IngestThreadEventType = "create" | "update" | "delete" | "members_update";

export type IngestThreadEvent = {
    idempotency_key: string;
    event_type: IngestThreadEventType;
    thread: {
        discord_thread_id: string;
        parent_channel_id: string;
        guild_id: string;
        name: string;
        archived: boolean;
        locked: boolean;
        auto_archive_duration?: number | null;
        archive_timestamp?: string | null;
        message_count?: number | null;
        member_count?: number | null;
        rate_limit_per_user?: number | null;
        owner_id?: string | null;
        owner_username?: string | null;
        owner_global_name?: string | null;
        last_message_id?: string | null;
        last_message_at?: string | null;
        created_timestamp?: string | null;
    };
    member_delta?: {
        added?: string[];
        removed?: string[];
    };
};

export type IngestChannelGuildSync = {
    idempotency_key: string;
    guilds: Array<{
        discord_guild_id: string;
        name: string;
    }>;
    channels: Array<{
        discord_channel_id: string;
        guild_id: string;
        name: string;
        type?: number | null;
        parent_id?: string | null;
        position?: number | null;
    }>;
};

export type FetchRuntimeConfigResult = {
    success: boolean;
    status?: number;
    etag?: string;
    config?: ConnectorRuntimeConfig;
    error?: string;
};

export function buildIdempotencyKey(
    tenantKey: string,
    connectorId: string,
    entity: "message" | "thread" | "sync" | "forward" | "backfill",
    entityId: string,
    eventType: string
) {
    return `${tenantKey}:${connectorId}:${entity}:${entityId}:${eventType}`;
}
