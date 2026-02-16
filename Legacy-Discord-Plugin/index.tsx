/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { ChannelStore, GuildStore } from "@webpack/common";
import type { Channel, Guild } from "discord-types/general";
import {
    buildIdempotencyKey,
    ConnectorRuntimeConfig,
    ConnectorTransportConfig,
    IngestChannelGuildSync,
    IngestMessageEvent,
    IngestThreadEvent,
} from "./contracts";

const Native = VencordNative.pluginHelpers.ChannelScraper as PluginNative<typeof import("./native")>;

interface MessageAuthor {
    id: string;
    username: string;
    globalName: string | null;
}

interface MessageAttachment {
    id: string;
    filename: string;
    url: string;
    size: number;
    content_type?: string;
}

interface FluxMessage {
    id: string;
    channel_id: string;
    content: string;
    author: MessageAuthor;
    timestamp: string;
    edited_timestamp: string | null;
    attachments: MessageAttachment[];
    mention_roles: string[];
}

const THREAD_TYPE = {
    GUILD_NEWS_THREAD: 10,
    GUILD_PUBLIC_THREAD: 11,
    GUILD_PRIVATE_THREAD: 12,
} as const;

interface ThreadMetadata {
    archived: boolean;
    auto_archive_duration: number;
    archive_timestamp: string;
    locked: boolean;
    create_timestamp?: string;
}

interface FluxThread {
    id: string;
    guild_id: string;
    parent_id: string;
    owner_id: string;
    name: string;
    type: number;
    last_message_id?: string | null;
    message_count?: number;
    member_count?: number;
    rate_limit_per_user?: number;
    thread_metadata?: ThreadMetadata;
}

interface FluxThreadMember {
    id?: string;
    user_id: string;
    join_timestamp: string;
    flags: number;
}

interface FluxThreadMembersUpdate {
    id: string;
    guild_id: string;
    member_count: number;
    added_members?: Array<FluxThreadMember & { user_id: string }>;
    removed_member_ids?: string[];
}

interface FluxThreadListSync {
    guild_id: string;
    channel_ids?: string[];
    threads: FluxThread[];
}

function isThreadType(type: number | null | undefined) {
    return type === THREAD_TYPE.GUILD_NEWS_THREAD ||
        type === THREAD_TYPE.GUILD_PUBLIC_THREAD ||
        type === THREAD_TYPE.GUILD_PRIVATE_THREAD;
}

function getGuildName(guildId: string): string {
    const guild = GuildStore.getGuild(guildId) as Guild | undefined;
    return guild?.name ?? guildId;
}

function getChannelName(channelId: string): string {
    const channel = ChannelStore.getChannel(channelId) as Channel | undefined;
    return channel?.name ?? channelId;
}

function normalizeContent(input: string) {
    return String(input ?? "")
        .replace(/<@!?(\d+)>/g, "@$1")
        .replace(/<@&(\d+)>/g, "@role:$1")
        .replace(/<#(\d+)>/g, "#channel:$1")
        .replace(/\s+/g, " ")
        .trim();
}

const settings = definePluginSettings({
    tenantKey: {
        type: OptionType.STRING,
        description: "Tenant key",
        default: "t1",
        placeholder: "t1",
    },
    connectorId: {
        type: OptionType.STRING,
        description: "Connector ID",
        default: "conn_01",
        placeholder: "conn_01",
    },
    ingestBaseUrl: {
        type: OptionType.STRING,
        description: "Ingest API base URL",
        default: "",
        placeholder: "https://convex-backend.example.com/http",
    },
    connectorToken: {
        type: OptionType.STRING,
        description: "Connector token (Bearer)",
        default: "",
        placeholder: "tok_...",
    },
    configPollIntervalMs: {
        type: OptionType.NUMBER,
        description: "Runtime config poll interval (ms)",
        default: 30_000,
    },
});

let monitoredChannels = new Map<string, string>();
let monitoredGuildIds = new Set<string>();
let runtimeConfigEtag = "";
let runtimeConfigPollActive = false;
let runtimeConfigPollAbort = false;

function getTransportConfig(): ConnectorTransportConfig {
    return {
        tenantKey: String(settings.store.tenantKey ?? "").trim(),
        connectorId: String(settings.store.connectorId ?? "").trim(),
        ingestBaseUrl: String(settings.store.ingestBaseUrl ?? "").trim(),
        connectorToken: String(settings.store.connectorToken ?? "").trim(),
        requestTimeoutMs: 15000,
        maxBatchSize: 100,
    };
}

function hasTransportConfig(config: ConnectorTransportConfig) {
    return Boolean(
        config.tenantKey &&
        config.connectorId &&
        config.ingestBaseUrl &&
        config.connectorToken
    );
}

function applyRuntimeConfig(config: ConnectorRuntimeConfig | undefined) {
    if (!config || !Array.isArray(config.sources)) return;

    const nextMap = new Map<string, string>();
    const nextGuilds = new Set<string>();

    for (const source of config.sources) {
        const guildId = String(source.guild_id ?? "").trim();
        const channelId = String(source.channel_id ?? "").trim();
        const enabled = source.is_enabled !== false;
        if (!guildId || !channelId || !enabled) continue;
        nextMap.set(channelId, guildId);
        nextGuilds.add(guildId);
    }

    monitoredChannels = nextMap;
    monitoredGuildIds = nextGuilds;

    console.log(`[ChannelScraper] Runtime config applied: ${nextGuilds.size} guild(s), ${nextMap.size} channel(s).`);
}

function listAccessibleChannelsForGuild(guildId: string) {
    const store: any = ChannelStore as any;
    const byGuild =
        (typeof store.getMutableGuildChannels === "function" ? store.getMutableGuildChannels(guildId) : null) ??
        (typeof store.getGuildChannels === "function" ? store.getGuildChannels(guildId) : null) ??
        null;

    const out: Array<{ guild_id: string; discord_channel_id: string; name: string; type?: number | null; parent_id?: string | null; position?: number | null }> = [];

    const push = (channel: any) => {
        const id = String(channel?.id ?? "").trim();
        const name = String(channel?.name ?? "").trim();
        if (!id || !name) return;
        out.push({
            guild_id: guildId,
            discord_channel_id: id,
            name,
            type: typeof channel?.type === "number" ? channel.type : null,
            parent_id: typeof channel?.parent_id === "string" ? channel.parent_id : null,
            position: typeof channel?.position === "number" ? channel.position : null,
        });
    };

    if (byGuild) {
        if (Array.isArray(byGuild)) {
            for (const ch of byGuild) push(ch);
            return out;
        }
        if (typeof byGuild === "object") {
            for (const value of Object.values(byGuild)) {
                if (Array.isArray(value)) {
                    for (const ch of value) push(ch);
                }
            }
            if (out.length > 0) return out;
        }
    }

    const all =
        (typeof store.getChannels === "function" ? store.getChannels() : null) ??
        (typeof store.getAllChannels === "function" ? store.getAllChannels() : null) ??
        null;

    if (all && typeof all === "object") {
        for (const channel of Object.values(all)) {
            if (String((channel as any)?.guild_id ?? "") !== guildId) continue;
            push(channel);
        }
    }

    return out;
}

function listAccessibleGuilds() {
    const store: any = GuildStore as any;
    const fromStore =
        (typeof store.getGuilds === "function" ? store.getGuilds() : null) ??
        (typeof store.getFlattenedGuilds === "function" ? store.getFlattenedGuilds() : null) ??
        null;

    const byId = new Map<string, { discord_guild_id: string; name: string }>();

    const push = (value: any) => {
        const guildLike = value?.guild ?? value;
        const id = String(guildLike?.id ?? "").trim();
        if (!id) return;
        const name = String(guildLike?.name ?? "").trim() || id;
        byId.set(id, { discord_guild_id: id, name });
    };

    if (fromStore) {
        if (Array.isArray(fromStore)) {
            for (const guild of fromStore) push(guild);
        } else if (typeof fromStore === "object") {
            for (const value of Object.values(fromStore)) {
                push(value);
            }
        }
    }

    if (byId.size === 0 && typeof store.getGuild === "function") {
        for (const guildId of monitoredGuildIds) {
            const guild = store.getGuild(guildId);
            push(guild ?? { id: guildId, name: guildId });
        }
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function syncGuildChannelSnapshot() {
    const transport = getTransportConfig();
    if (!hasTransportConfig(transport)) return;

    const guilds: IngestChannelGuildSync["guilds"] = [];
    const channels: IngestChannelGuildSync["channels"] = [];
    const accessibleGuilds = listAccessibleGuilds();
    const guildNameById = new Map(accessibleGuilds.map((guild) => [guild.discord_guild_id, guild.name]));
    const discoveryGuildIds = accessibleGuilds.length > 0
        ? accessibleGuilds.map((guild) => guild.discord_guild_id)
        : Array.from(monitoredGuildIds);

    for (const guildId of discoveryGuildIds) {
        guilds.push({
            discord_guild_id: guildId,
            name: guildNameById.get(guildId) ?? getGuildName(guildId),
        });
        const rows = listAccessibleChannelsForGuild(guildId);
        for (const row of rows) {
            channels.push({
                discord_channel_id: row.discord_channel_id,
                guild_id: row.guild_id,
                name: row.name,
                type: row.type ?? null,
                parent_id: row.parent_id ?? null,
                position: row.position ?? null,
            });
        }
    }

    if (channels.length === 0 && guilds.length === 0) return;

    await Native.enqueueChannelGuildSync({
        idempotency_key: buildIdempotencyKey(
            transport.tenantKey,
            transport.connectorId,
            "sync",
            String(Date.now()),
            "snapshot"
        ),
        guilds,
        channels,
    });
}

async function pollRuntimeConfigLoop() {
    runtimeConfigPollActive = true;
    runtimeConfigPollAbort = false;

    while (runtimeConfigPollActive && !runtimeConfigPollAbort) {
        const transport = getTransportConfig();
        if (!hasTransportConfig(transport)) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
        }

        const res = await Native.fetchRuntimeConfig(transport, runtimeConfigEtag || undefined);
        if (res?.success && res.status === 200 && res.config) {
            applyRuntimeConfig(res.config);
            runtimeConfigEtag = String(res.etag ?? "");
            await syncGuildChannelSnapshot();
        } else if (!res?.success && res?.error) {
            console.error("[ChannelScraper] Runtime config poll failed:", res.error);
        }

        const interval = Math.max(3000, Number(settings.store.configPollIntervalMs ?? 30000));
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}

async function handleMessage(message: FluxMessage, isUpdate: boolean) {
    const transport = getTransportConfig();
    if (!hasTransportConfig(transport)) return;

    const channel = ChannelStore.getChannel(message.channel_id) as (Channel & { type?: number; parent_id?: string }) | undefined;
    if (!channel || !channel.guild_id) return;

    const isThread = isThreadType(channel.type);
    const parentChannelId = isThread ? channel.parent_id ?? null : null;
    const effectiveChannelId = isThread && parentChannelId ? parentChannelId : message.channel_id;
    const expectedGuildId = monitoredChannels.get(effectiveChannelId);

    if (!expectedGuildId || expectedGuildId !== channel.guild_id) return;

    const createdAtIso = new Date(message.timestamp).toISOString();
    const editedAtIso = message.edited_timestamp ? new Date(message.edited_timestamp).toISOString() : null;
    const eventType = isUpdate ? "update" : "create";

    const event: IngestMessageEvent = {
        idempotency_key: buildIdempotencyKey(
            transport.tenantKey,
            transport.connectorId,
            "message",
            message.id,
            eventType
        ),
        event_type: eventType,
        discord_message_id: message.id,
        discord_guild_id: channel.guild_id,
        discord_channel_id: effectiveChannelId,
        discord_thread_id: isThread ? message.channel_id : null,
        discord_author_id: message.author?.id ?? null,
        author_username: message.author?.username ?? null,
        author_global_name: message.author?.globalName ?? null,
        content_raw: message.content ?? "",
        content_clean: normalizeContent(message.content ?? ""),
        created_at: createdAtIso,
        edited_at: editedAtIso,
        deleted_at: null,
        attachments: (message.attachments ?? []).map((attachment) => ({
            discord_attachment_id: String(attachment.id ?? `${message.id}-${attachment.filename}`),
            filename: String(attachment.filename ?? "file"),
            source_url: String(attachment.url ?? ""),
            size: Number(attachment.size ?? 0),
            content_type: attachment.content_type ?? null,
        })),
        embeds: [],
        mentioned_role_ids: Array.isArray(message.mention_roles) ? message.mention_roles.map((r) => String(r)) : [],
    };

    await Native.enqueueMessageEvent(event);
}

async function handleThread(thread: FluxThread, eventType: IngestThreadEvent["event_type"]) {
    const transport = getTransportConfig();
    if (!hasTransportConfig(transport)) return;
    if (!isThreadType(thread.type)) return;

    const expectedGuildId = monitoredChannels.get(thread.parent_id);
    if (!expectedGuildId || expectedGuildId !== thread.guild_id) return;

    const payload: IngestThreadEvent = {
        idempotency_key: buildIdempotencyKey(
            transport.tenantKey,
            transport.connectorId,
            "thread",
            thread.id,
            eventType
        ),
        event_type: eventType,
        thread: {
            discord_thread_id: thread.id,
            parent_channel_id: thread.parent_id,
            guild_id: thread.guild_id,
            name: thread.name,
            archived: thread.thread_metadata?.archived ?? false,
            locked: thread.thread_metadata?.locked ?? false,
            auto_archive_duration: thread.thread_metadata?.auto_archive_duration ?? null,
            archive_timestamp: thread.thread_metadata?.archive_timestamp ?? null,
            message_count: thread.message_count ?? null,
            member_count: thread.member_count ?? null,
            rate_limit_per_user: thread.rate_limit_per_user ?? null,
            owner_id: thread.owner_id ?? null,
            owner_username: null,
            owner_global_name: null,
            last_message_id: thread.last_message_id ?? null,
            last_message_at: null,
            created_timestamp: thread.thread_metadata?.create_timestamp ?? null,
        },
    };

    await Native.enqueueThreadEvent(payload);
}

async function handleThreadMembersUpdate(update: FluxThreadMembersUpdate) {
    const transport = getTransportConfig();
    if (!hasTransportConfig(transport)) return;

    const thread = ChannelStore.getChannel(update.id) as (Channel & { parent_id?: string }) | undefined;
    const parentChannelId = String(thread?.parent_id ?? "").trim();
    if (!parentChannelId || !monitoredChannels.has(parentChannelId)) return;

    const payload: IngestThreadEvent = {
        idempotency_key: buildIdempotencyKey(
            transport.tenantKey,
            transport.connectorId,
            "thread",
            update.id,
            "members_update"
        ),
        event_type: "members_update",
        thread: {
            discord_thread_id: update.id,
            parent_channel_id: parentChannelId,
            guild_id: update.guild_id,
            name: getChannelName(update.id),
            archived: false,
            locked: false,
            member_count: update.member_count,
        },
        member_delta: {
            added: Array.isArray(update.added_members) ? update.added_members.map((member) => String(member.user_id)) : [],
            removed: Array.isArray(update.removed_member_ids) ? update.removed_member_ids.map((id) => String(id)) : [],
        },
    };

    await Native.enqueueThreadEvent(payload);
}

export default definePlugin({
    name: "ChannelScraper",
    description: "Forwards configured Discord events to an Appwrite-first ingestion API",
    authors: [Devs.Ven],
    settings,

    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: FluxMessage; optimistic: boolean; }) {
            if (optimistic) return;
            void handleMessage(message, false);
        },
        MESSAGE_UPDATE({ message }: { message: FluxMessage; }) {
            if (!message.content && message.content !== "") return;
            void handleMessage(message, true);
        },
        THREAD_CREATE({ channel }: { channel: FluxThread }) {
            if (!channel) return;
            void handleThread(channel, "create");
        },
        THREAD_UPDATE({ channel }: { channel: FluxThread }) {
            if (!channel) return;
            void handleThread(channel, "update");
        },
        THREAD_DELETE({ channel }: { channel: FluxThread }) {
            if (!channel) return;
            void handleThread(channel, "delete");
        },
        THREAD_LIST_SYNC(data: FluxThreadListSync) {
            if (!data?.threads) return;
            for (const thread of data.threads) {
                void handleThread(thread, "update");
            }
        },
        THREAD_MEMBERS_UPDATE(data: FluxThreadMembersUpdate) {
            if (!data?.id) return;
            void handleThreadMembersUpdate(data);
        },
    },

    async start() {
        console.log("[ChannelScraper] Plugin started.");

        const transport = getTransportConfig();
        if (!hasTransportConfig(transport)) {
            console.log("[ChannelScraper] Missing ingest config. Fill ingestBaseUrl, connectorId, and connectorToken.");
            return;
        }

        const configured = await Native.configureConnectorTransport(transport);
        if (!configured?.success) {
            console.error("[ChannelScraper] Failed to configure connector transport.");
            return;
        }

        const connectivity = await Native.testIngestConnection(transport);
        if (!connectivity?.success) {
            console.error("[ChannelScraper] Ingest connectivity check failed:", connectivity?.error || connectivity?.status);
        }

        void pollRuntimeConfigLoop();

        (async () => {
            while (runtimeConfigPollActive && !runtimeConfigPollAbort) {
                await new Promise((resolve) => setTimeout(resolve, 60_000));
                try {
                    await syncGuildChannelSnapshot();
                } catch (error) {
                    console.error("[ChannelScraper] Snapshot sync error:", error);
                }
            }
        })();
    },

    async stop() {
        runtimeConfigPollActive = false;
        runtimeConfigPollAbort = true;
        await Native.flushConnectorQueue();
        await Native.shutdownConnectorTransport();
        console.log("[ChannelScraper] Plugin stopped.");
    },
});
