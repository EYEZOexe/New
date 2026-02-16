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

type DiscoveryChannelRow = {
    guild_id: string;
    discord_channel_id: string;
    name: string;
    type?: number | null;
    parent_id?: string | null;
    position?: number | null;
};

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
        default: 5_000,
    },
});

let monitoredChannels = new Map<string, string>();
let monitoredGuildIds = new Set<string>();
let runtimeConfigEtag = "";
let runtimeConfigPollActive = false;
let runtimeConfigPollAbort = false;
let loggedChannelStoreDiagnostics = false;
const REST_CHANNEL_CACHE_TTL_MS = 2 * 60_000;
const restChannelCache = new Map<string, { expiresAt: number; rows: DiscoveryChannelRow[] }>();
let loggedRestAuthMissing = false;
const loggedRestFailureGuilds = new Set<string>();
let discoveredChannelStore: any | null = null;
let discoveredChannelStoreScanned = false;
let lastHandledDiscoveryRequestVersion = -1;
let initialDiscoverySnapshotDone = false;
let lastAppliedConfigVersion = -1;
const loggedRestErrorGuilds = new Set<string>();

function hasOwnFunction(obj: unknown, key: string) {
    if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return false;
    try {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (!descriptor) return false;
        if (typeof descriptor.value === "function") return true;
        return typeof descriptor.get === "function";
    } catch {
        return false;
    }
}

function getFunctionIfOwn(obj: unknown, key: string): ((...args: any[]) => any) | null {
    if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return null;
    try {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (!descriptor) return null;
        if (typeof descriptor.value === "function") return descriptor.value;
        if (typeof descriptor.get === "function") {
            const value = descriptor.get.call(obj);
            return typeof value === "function" ? value : null;
        }
    } catch {
        return null;
    }
    return null;
}

function getDiscoveredChannelStore() {
    if (discoveredChannelStoreScanned) return discoveredChannelStore;
    discoveredChannelStoreScanned = true;

    try {
        const chunk = (window as any).webpackChunkdiscord_app;
        if (!Array.isArray(chunk) || typeof chunk.push !== "function") return null;

        chunk.push([
            [Math.random()],
            {},
            (req: any) => {
                const modules = Object.values(req?.c ?? {}) as any[];
                for (const mod of modules) {
                    const candidate = mod?.exports?.default ?? mod?.exports;
                    if (!candidate || typeof candidate !== "object") continue;

                    const hasGuildChannelsApi =
                        hasOwnFunction(candidate, "getMutableGuildChannels") ||
                        hasOwnFunction(candidate, "getGuildChannels") ||
                        hasOwnFunction(candidate, "getChannelsForGuild") ||
                        hasOwnFunction(candidate, "getMutableChannelsForGuild") ||
                        hasOwnFunction(candidate, "getSelectableChannels");

                    // Keep this strict: broad heuristics can latch onto unrelated modules
                    // that expose similarly named methods (which then return locale strings).
                    if (!hasGuildChannelsApi) continue;

                    discoveredChannelStore = candidate;
                    break;
                }
            },
        ]);
    } catch {
        discoveredChannelStore = null;
    }

    return discoveredChannelStore;
}

function asNonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "";
}

function asFiniteNumberOrNull(value: unknown) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : null;
}

function getChannelStoreCandidates() {
    const stores: any[] = [];
    const baseStore: any = ChannelStore as any;
    const dynamicStore = getDiscoveredChannelStore();

    if (baseStore && typeof baseStore === "object") stores.push(baseStore);
    if (dynamicStore && typeof dynamicStore === "object" && dynamicStore !== baseStore) {
        stores.push(dynamicStore);
    }

    return stores;
}

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
        const isSource = source.is_source !== false;
        if (!guildId || !channelId || !enabled || !isSource) continue;
        nextMap.set(channelId, guildId);
        nextGuilds.add(guildId);
    }

    monitoredChannels = nextMap;
    monitoredGuildIds = nextGuilds;

    console.log(`[ChannelScraper] Runtime config applied: ${nextGuilds.size} guild(s), ${nextMap.size} channel(s).`);
}

function listAccessibleChannelsForGuild(guildId: string) {
    const stores = getChannelStoreCandidates();

    const out: DiscoveryChannelRow[] = [];
    const byId = new Map<string, (typeof out)[number]>();
    const seen = new WeakSet<object>();

    const toChannelLike = (value: any) => {
        const channel = value?.channel ?? value?.record?.channel ?? value?.item?.channel ?? value;
        if (!channel || typeof channel !== "object") return null;

        const id = String(channel?.id ?? "").trim();
        if (!id) return null;

        const channelGuildId = String(channel?.guild_id ?? channel?.guildId ?? "").trim();
        if (channelGuildId && channelGuildId !== guildId) return null;

        const name = String(channel?.name ?? "").trim() || id;

        return {
            id,
            guild_id: channelGuildId || guildId,
            name,
            type: typeof channel?.type === "number" ? channel.type : null,
            parent_id: typeof channel?.parent_id === "string"
                ? channel.parent_id
                : typeof channel?.parentId === "string"
                    ? channel.parentId
                    : null,
            position: typeof channel?.position === "number" ? channel.position : null,
        };
    };

    const push = (value: any) => {
        const channel = toChannelLike(value);
        if (!channel) return;
        byId.set(channel.id, {
            guild_id: guildId,
            discord_channel_id: channel.id,
            name: channel.name,
            type: channel.type,
            parent_id: channel.parent_id,
            position: channel.position,
        });
    };

    const walk = (value: any, depth = 0) => {
        if (depth > 5) return;
        if (!value) return;

        if (Array.isArray(value)) {
            for (const item of value) walk(item, depth + 1);
            return;
        }

        if (typeof value !== "object") return;

        const obj = value as object;
        if (seen.has(obj)) return;
        seen.add(obj);

        push(value);

        for (const nested of Object.values(value as Record<string, unknown>)) {
            if (nested && (typeof nested === "object" || Array.isArray(nested))) {
                walk(nested, depth + 1);
            }
        }
    };

    const runMethod = (name: string, args: unknown[]) => {
        for (const store of stores) {
            const fn = getFunctionIfOwn(store, name);
            if (!fn) continue;
            try {
                const value = fn.apply(store, args as any[]);
                if (value) walk(value);
            } catch {
                // No-op: incompatible method signature in this Discord build.
            }
        }
    };

    const preferredMethods: Array<[string, unknown[]]> = [
        ["getMutableGuildChannels", [guildId]],
        ["getGuildChannels", [guildId]],
        ["getChannelsForGuild", [guildId]],
        ["getMutableChannelsForGuild", [guildId]],
        ["getSelectableChannels", [guildId]],
        ["getChannels", [guildId]],
        ["getAllChannels", [guildId]],
        ["getChannels", []],
        ["getAllChannels", []],
    ];

    for (const [name, args] of preferredMethods) {
        runMethod(name, args);
        if (byId.size > 0 && args.length > 0) break;
    }

    // Last-resort: inspect guild object shape for embedded channel maps.
    if (byId.size === 0) {
        try {
            const guild = (GuildStore as any)?.getGuild?.(guildId);
            if (guild) {
                walk((guild as any).channels);
                walk((guild as any)._channels);
                walk((guild as any).guildChannels);
            }
        } catch {
            // ignore
        }
    }

    if (byId.size === 0) runMethod("getChannels", []);
    if (byId.size === 0) runMethod("getAllChannels", []);

    out.push(...byId.values());
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
}

function listAllAccessibleGuildChannels() {
    const stores = getChannelStoreCandidates();

    const byId = new Map<string, DiscoveryChannelRow>();
    const seen = new WeakSet<object>();

    const toChannelLike = (value: any) => {
        const channel = value?.channel ?? value?.record?.channel ?? value?.item?.channel ?? value;
        if (!channel || typeof channel !== "object") return null;

        const id = String(channel?.id ?? "").trim();
        const guildId = String(channel?.guild_id ?? channel?.guildId ?? "").trim();
        if (!id || !guildId) return null;

        const name = String(channel?.name ?? "").trim() || id;
        return {
            guild_id: guildId,
            discord_channel_id: id,
            name,
            type: typeof channel?.type === "number" ? channel.type : null,
            parent_id: typeof channel?.parent_id === "string"
                ? channel.parent_id
                : typeof channel?.parentId === "string"
                    ? channel.parentId
                    : null,
            position: typeof channel?.position === "number" ? channel.position : null,
        };
    };

    const walk = (value: any, depth = 0) => {
        if (depth > 8) return;
        if (!value) return;

        if (Array.isArray(value)) {
            for (const item of value) walk(item, depth + 1);
            return;
        }

        if (typeof value !== "object") return;

        const obj = value as object;
        if (seen.has(obj)) return;
        seen.add(obj);

        const maybeChannel = toChannelLike(value);
        if (maybeChannel) {
            byId.set(maybeChannel.discord_channel_id, maybeChannel);
        }

        for (const nested of Object.values(value as Record<string, unknown>)) {
            if (nested && (typeof nested === "object" || Array.isArray(nested))) {
                walk(nested, depth + 1);
            }
        }
    };

    const runMethod = (name: string, args: unknown[]) => {
        for (const store of stores) {
            const fn = getFunctionIfOwn(store, name);
            if (!fn) continue;
            try {
                const value = fn.apply(store, args as any[]);
                if (value) walk(value);
            } catch {
                // ignore incompatible signatures
            }
        }
    };

    const guildIds = new Set<string>();
    try {
        const rawGuilds =
            (typeof (GuildStore as any)?.getGuilds === "function"
                ? (GuildStore as any).getGuilds()
                : null) ??
            (typeof (GuildStore as any)?.getFlattenedGuilds === "function"
                ? (GuildStore as any).getFlattenedGuilds()
                : null);
        if (rawGuilds && typeof rawGuilds === "object") {
            const values = Array.isArray(rawGuilds) ? rawGuilds : Object.values(rawGuilds);
            for (const value of values) {
                const guildLike = (value as any)?.guild ?? value;
                const id = String((guildLike as any)?.id ?? "").trim();
                if (id) guildIds.add(id);
            }
        }
    } catch {
        // ignore
    }

    for (const guildId of guildIds) {
        runMethod("getMutableGuildChannels", [guildId]);
        runMethod("getGuildChannels", [guildId]);
        runMethod("getChannelsForGuild", [guildId]);
        runMethod("getMutableChannelsForGuild", [guildId]);
        runMethod("getSelectableChannels", [guildId]);
        runMethod("getChannels", [guildId]);
        runMethod("getAllChannels", [guildId]);
    }

    runMethod("getChannels", []);
    runMethod("getAllChannels", []);

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function listVisibleChannelsFromDom(guildIdFilter?: string) {
    const byId = new Map<string, DiscoveryChannelRow>();
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href^="/channels/"]');

    for (const anchor of anchors) {
        const href = anchor.getAttribute("href") ?? "";
        const match = href.match(/^\/channels\/(\d+)\/(\d+)/);
        if (!match) continue;

        const guildId = match[1];
        const channelId = match[2];
        if (!guildId || !channelId) continue;
        if (guildIdFilter && guildId !== guildIdFilter) continue;

        const nameFromNode = anchor.querySelector<HTMLElement>('[class*="name"]')?.textContent?.trim() ?? "";
        const aria = String(anchor.getAttribute("aria-label") ?? "").trim();
        const nameFromAria = aria.includes(" (") ? aria.slice(0, aria.indexOf(" (")).trim() : aria;
        const fallbackName = getChannelName(channelId);
        const name = nameFromNode || nameFromAria || fallbackName || channelId;

        byId.set(channelId, {
            guild_id: guildId,
            discord_channel_id: channelId,
            name,
            type: null,
            parent_id: null,
            position: null,
        });
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function readDiscordAuthToken() {
    const readTokenFromStorage = (storage: Storage | undefined | null) => {
        if (!storage) return null;
        try {
            const raw = storage.getItem("token");
            if (!raw) return null;
            const parsed = raw.startsWith("\"") ? JSON.parse(raw) : raw;
            const token = String(parsed ?? "").trim();
            return token || null;
        } catch {
            return null;
        }
    };

    const tokenFromLocal = readTokenFromStorage(window.localStorage);
    if (tokenFromLocal) return tokenFromLocal;

    const tokenFromSession = readTokenFromStorage(window.sessionStorage);
    if (tokenFromSession) return tokenFromSession;
    return null;
}

function toDiscoveryChannelRow(value: any, guildIdFallback: string): DiscoveryChannelRow | null {
    const channel = value?.channel ?? value?.record?.channel ?? value;
    if (!channel || typeof channel !== "object") return null;

    const channelId = String(channel?.id ?? "").trim();
    if (!channelId) return null;

    const guildId = String(channel?.guild_id ?? channel?.guildId ?? guildIdFallback ?? "").trim();
    if (!guildId) return null;

    const name = String(channel?.name ?? "").trim() || channelId;

    return {
        guild_id: guildId,
        discord_channel_id: channelId,
        name,
        type: typeof channel?.type === "number" ? channel.type : null,
        parent_id: typeof channel?.parent_id === "string"
            ? channel.parent_id
            : typeof channel?.parentId === "string"
                ? channel.parentId
                : null,
        position: typeof channel?.position === "number" ? channel.position : null,
    };
}

async function fetchGuildChannelsViaRest(guildId: string): Promise<DiscoveryChannelRow[]> {
    const now = Date.now();
    const cached = restChannelCache.get(guildId);
    if (cached && cached.expiresAt > now) return cached.rows;

    const token = readDiscordAuthToken();
    if (!token && !loggedRestAuthMissing) {
        loggedRestAuthMissing = true;
        console.warn("[ChannelScraper] REST fallback: Discord token not found via storage/webpack. Trying cookie-auth requests.");
    }

    const endpoints = [
        `/api/v10/guilds/${encodeURIComponent(guildId)}/channels`,
        `/api/v9/guilds/${encodeURIComponent(guildId)}/channels`,
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: token } : {}),
                },
            });

            if (!response.ok) {
                if (!loggedRestFailureGuilds.has(guildId)) {
                    loggedRestFailureGuilds.add(guildId);
                    console.warn(`[ChannelScraper] REST fallback failed for guild ${guildId} at ${endpoint}: HTTP ${response.status}`);
                }
                if (response.status === 401 || response.status === 403) break;
                continue;
            }

            const json = await response.json();
            if (!Array.isArray(json)) continue;

            const rows = json
                .map((value) => toDiscoveryChannelRow(value, guildId))
                .filter((row): row is DiscoveryChannelRow => Boolean(row));

            restChannelCache.set(guildId, {
                expiresAt: now + REST_CHANNEL_CACHE_TTL_MS,
                rows,
            });
            return rows;
        } catch {
            if (!loggedRestErrorGuilds.has(guildId)) {
                loggedRestErrorGuilds.add(guildId);
                console.warn(`[ChannelScraper] REST fallback network error for guild ${guildId} at ${endpoint}`);
            }
            // Try next endpoint.
        }
    }

    return [];
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

    // Fallback: derive guild IDs from ChannelStore when GuildStore is unavailable/empty.
    if (byId.size === 0) {
        const channels = listAllAccessibleGuildChannels();
        for (const channel of channels) {
            if (!byId.has(channel.guild_id)) {
                byId.set(channel.guild_id, {
                    discord_guild_id: channel.guild_id,
                    name: getGuildName(channel.guild_id),
                });
            }
        }
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function syncGuildChannelSnapshot(targetGuildId?: string) {
    const transport = getTransportConfig();
    if (!hasTransportConfig(transport)) return;

    const guilds: IngestChannelGuildSync["guilds"] = [];
    const channels: IngestChannelGuildSync["channels"] = [];
    const accessibleGuilds = listAccessibleGuilds();
    let restFallbackChannels = 0;
    let domFallbackChannels = 0;
    let storeFallbackChannels = 0;

    if (!loggedChannelStoreDiagnostics) {
        loggedChannelStoreDiagnostics = true;
        const stores = getChannelStoreCandidates();
        const methodCandidates = [
            "getMutableGuildChannels",
            "getGuildChannels",
            "getChannelsForGuild",
            "getMutableChannelsForGuild",
            "getSelectableChannels",
            "getChannels",
            "getAllChannels",
            "getChannel",
        ];
        const available = new Set<string>();
        for (const store of stores) {
            for (const name of methodCandidates) {
                if (typeof store?.[name] === "function") available.add(name);
            }
        }
        console.log(`[ChannelScraper] ChannelStore available methods: ${Array.from(available).join(", ") || "(none detected)"}`);
    }
    const guildNameById = new Map(accessibleGuilds.map((guild) => [guild.discord_guild_id, guild.name]));
    const normalizedTargetGuildId = String(targetGuildId ?? "").trim();
    const discoveryGuildIds = normalizedTargetGuildId
        ? [normalizedTargetGuildId]
        : accessibleGuilds.length > 0
            ? accessibleGuilds.map((guild) => guild.discord_guild_id)
            : Array.from(monitoredGuildIds);

    for (const guildId of discoveryGuildIds) {
        guilds.push({
            discord_guild_id: guildId,
            name: guildNameById.get(guildId) ?? getGuildName(guildId),
        });
        let rows: DiscoveryChannelRow[] = [];

        // REST is the preferred path for explicit channel discovery requests.
        // It avoids broad runtime probing and keeps latency predictable.
        const restRows = await fetchGuildChannelsViaRest(guildId);
        if (restRows.length > 0) {
            rows = restRows;
            restFallbackChannels += restRows.length;
        }

        if (rows.length === 0) {
            // DOM fallback is cheap and does not depend on runtime store internals.
            const domRows = listVisibleChannelsFromDom(guildId);
            if (domRows.length > 0) {
                rows = domRows;
                domFallbackChannels += domRows.length;
            }
        }
        if (rows.length === 0) {
            const storeRows = listAccessibleChannelsForGuild(guildId);
            if (storeRows.length > 0) {
                rows = storeRows;
                storeFallbackChannels += storeRows.length;
            }
        }
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

    console.log(
        `[ChannelScraper] Discovery snapshot prepared: ${guilds.length} guild(s), ${channels.length} channel(s), restChannels=${restFallbackChannels}, domChannels=${domFallbackChannels}, storeChannels=${storeFallbackChannels}, targetGuild=${normalizedTargetGuildId || "all"}.`
    );

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

async function syncGuildSnapshotOnly() {
    const transport = getTransportConfig();
    if (!hasTransportConfig(transport)) return;

    const accessibleGuilds = listAccessibleGuilds();
    const guilds: IngestChannelGuildSync["guilds"] = accessibleGuilds.map((guild) => ({
        discord_guild_id: guild.discord_guild_id,
        name: guild.name,
    }));

    if (guilds.length === 0) return;

    console.log(
        `[ChannelScraper] Guild snapshot prepared: ${guilds.length} guild(s), 0 channel(s).`
    );

    await Native.enqueueChannelGuildSync({
        idempotency_key: buildIdempotencyKey(
            transport.tenantKey,
            transport.connectorId,
            "sync",
            String(Date.now()),
            "guilds"
        ),
        guilds,
        channels: [],
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
            const configVersionRaw = Number(res.config.config_version ?? 0);
            const configVersion = Number.isFinite(configVersionRaw) ? configVersionRaw : 0;
            if (configVersion !== lastAppliedConfigVersion) {
                applyRuntimeConfig(res.config);
                lastAppliedConfigVersion = configVersion;
                console.log(`[ChannelScraper] Applied runtime config version ${configVersion}.`);
            }
            runtimeConfigEtag = String(res.etag ?? "");

            const requestVersionRaw = Number(res.config.discovery_request?.version ?? 0);
            const requestVersion = Number.isFinite(requestVersionRaw) ? requestVersionRaw : 0;
            const requestedGuildId = typeof res.config.discovery_request?.guild_id === "string"
                ? res.config.discovery_request.guild_id.trim()
                : "";

            const shouldRunRequestedSync = requestVersion > lastHandledDiscoveryRequestVersion;
            const shouldRunInitialSync = !initialDiscoverySnapshotDone;

            if (shouldRunRequestedSync || shouldRunInitialSync) {
                if (shouldRunRequestedSync) {
                    lastHandledDiscoveryRequestVersion = requestVersion;
                    console.log(
                        `[ChannelScraper] Discovery fetch request received: version=${requestVersion}, guild=${requestedGuildId || "guilds-only"}`
                    );
                    if (requestedGuildId) {
                        await syncGuildChannelSnapshot(requestedGuildId);
                    } else {
                        await syncGuildSnapshotOnly();
                    }
                } else {
                    console.log("[ChannelScraper] Running initial discovery snapshot.");
                    await syncGuildSnapshotOnly();
                }
                initialDiscoverySnapshotDone = true;
            }
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

    const threadId = asNonEmptyString(thread.id);
    if (!threadId) return;

    const cachedThread = ChannelStore.getChannel(threadId) as (Channel & { parent_id?: string; guild_id?: string; name?: string }) | undefined;
    const parentChannelId = asNonEmptyString(thread.parent_id) || asNonEmptyString(cachedThread?.parent_id);
    if (!parentChannelId) return;

    const expectedGuildId = monitoredChannels.get(parentChannelId);
    if (!expectedGuildId) return;

    const guildId = asNonEmptyString(thread.guild_id) || asNonEmptyString(cachedThread?.guild_id) || expectedGuildId;
    if (expectedGuildId !== guildId) return;

    const threadName = asNonEmptyString(thread.name) || asNonEmptyString(cachedThread?.name) || getChannelName(threadId) || threadId;
    const metadata = thread.thread_metadata;

    const payload: IngestThreadEvent = {
        idempotency_key: buildIdempotencyKey(
            transport.tenantKey,
            transport.connectorId,
            "thread",
            threadId,
            eventType
        ),
        event_type: eventType,
        thread: {
            discord_thread_id: threadId,
            parent_channel_id: parentChannelId,
            guild_id: guildId,
            name: threadName,
            archived: Boolean(metadata?.archived ?? false),
            locked: Boolean(metadata?.locked ?? false),
            auto_archive_duration: asFiniteNumberOrNull(metadata?.auto_archive_duration),
            archive_timestamp: asNonEmptyString(metadata?.archive_timestamp) || null,
            message_count: asFiniteNumberOrNull(thread.message_count),
            member_count: asFiniteNumberOrNull(thread.member_count),
            rate_limit_per_user: asFiniteNumberOrNull(thread.rate_limit_per_user),
            owner_id: asNonEmptyString(thread.owner_id) || null,
            owner_username: null,
            owner_global_name: null,
            last_message_id: asNonEmptyString(thread.last_message_id) || null,
            last_message_at: null,
            created_timestamp: asNonEmptyString(metadata?.create_timestamp) || null,
        },
    };

    await Native.enqueueThreadEvent(payload);
}

async function handleThreadMembersUpdate(update: FluxThreadMembersUpdate) {
    const transport = getTransportConfig();
    if (!hasTransportConfig(transport)) return;

    const threadId = asNonEmptyString(update.id);
    if (!threadId) return;

    const thread = ChannelStore.getChannel(threadId) as (Channel & { parent_id?: string; guild_id?: string; name?: string }) | undefined;
    const parentChannelId = asNonEmptyString(thread?.parent_id);
    if (!parentChannelId) return;

    const expectedGuildId = monitoredChannels.get(parentChannelId);
    if (!expectedGuildId) return;

    const guildId = asNonEmptyString(update.guild_id) || asNonEmptyString(thread?.guild_id) || expectedGuildId;
    if (guildId !== expectedGuildId) return;

    const payload: IngestThreadEvent = {
        idempotency_key: buildIdempotencyKey(
            transport.tenantKey,
            transport.connectorId,
            "thread",
            threadId,
            "members_update"
        ),
        event_type: "members_update",
        thread: {
            discord_thread_id: threadId,
            parent_channel_id: parentChannelId,
            guild_id: guildId,
            name: asNonEmptyString(thread?.name) || getChannelName(threadId) || threadId,
            archived: false,
            locked: false,
            member_count: asFiniteNumberOrNull(update.member_count),
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
        runtimeConfigEtag = "";
        lastHandledDiscoveryRequestVersion = -1;
        initialDiscoverySnapshotDone = false;
        lastAppliedConfigVersion = -1;
        restChannelCache.clear();
        loggedRestFailureGuilds.clear();
        loggedRestErrorGuilds.clear();
        loggedRestAuthMissing = false;
        discoveredChannelStore = null;
        discoveredChannelStoreScanned = false;
        loggedChannelStoreDiagnostics = false;

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
    },

    async stop() {
        runtimeConfigPollActive = false;
        runtimeConfigPollAbort = true;
        await Native.flushConnectorQueue();
        await Native.shutdownConnectorTransport();
        console.log("[ChannelScraper] Plugin stopped.");
    },
});
