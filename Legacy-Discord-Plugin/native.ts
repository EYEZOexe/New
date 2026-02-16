import { IpcMainInvokeEvent } from "electron";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
    ConnectorTransportConfig,
    FetchRuntimeConfigResult,
    IngestChannelGuildSync,
    IngestMessageEvent,
    IngestThreadEvent,
} from "./contracts";

type QueueItemKind = "message" | "thread" | "sync";

type QueueItem = {
    id: string;
    kind: QueueItemKind;
    createdAt: string;
    attempts: number;
    nextAttemptAt: number;
    payload: IngestMessageEvent | IngestThreadEvent | IngestChannelGuildSync;
};

type ApiSuccess = {
    ok: true;
    accepted?: number;
    deduped?: number;
    run_id?: string;
    correlation_id?: string;
};

type ApiError = {
    ok: false;
    error_code?: string;
    message?: string;
    correlation_id?: string;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 250;
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 750;
const MAX_BACKOFF_MS = 30_000;

let transportConfig: ConnectorTransportConfig | null = null;
let queue: QueueItem[] = [];
let processingQueue = false;
let flushTimer: NodeJS.Timeout | null = null;
let queueLoaded = false;

function getOutboxPath() {
    const explicit = process.env.CHANNEL_SCRAPER_OUTBOX_PATH?.trim();
    if (explicit) return explicit;
    return path.join(process.cwd(), "channel-scraper-outbox.json");
}

async function loadQueueFromDisk() {
    if (queueLoaded) return;
    queueLoaded = true;

    try {
        const raw = await fs.readFile(getOutboxPath(), "utf8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const restored: QueueItem[] = [];

        for (const item of parsed) {
            if (!item || typeof item !== "object") continue;
            const id = String((item as any).id ?? "").trim();
            const kind = String((item as any).kind ?? "").trim() as QueueItemKind;
            if (!id || (kind !== "message" && kind !== "thread" && kind !== "sync")) continue;
            restored.push({
                id,
                kind,
                createdAt: String((item as any).createdAt ?? new Date().toISOString()),
                attempts: Number((item as any).attempts ?? 0),
                nextAttemptAt: Number((item as any).nextAttemptAt ?? Date.now()),
                payload: (item as any).payload,
            });
        }

        queue = restored;
        if (queue.length > 0) {
            console.log(`[ChannelScraper] Restored ${queue.length} outbox item(s) from disk.`);
        }
    } catch {
        // No persisted queue yet.
    }
}

async function persistQueue() {
    try {
        await fs.writeFile(getOutboxPath(), JSON.stringify(queue), "utf8");
    } catch (error) {
        console.error("[ChannelScraper] Failed to persist outbox queue:", error);
    }
}

function nowIso() {
    return new Date().toISOString();
}

function sanitizeBaseUrl(url: string) {
    return String(url || "").trim().replace(/\/+$/, "");
}

function isRetryable(status: number) {
    if (status === 409) return false;
    if (status === 429) return true;
    return status >= 500;
}

function backoffMs(attempt: number) {
    const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** attempt));
    const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exp * 0.2)));
    return exp + jitter;
}

function hasConfiguredTransport() {
    if (!transportConfig) return false;
    return Boolean(
        transportConfig.ingestBaseUrl?.trim() &&
        transportConfig.connectorId?.trim() &&
        transportConfig.tenantKey?.trim() &&
        transportConfig.connectorToken?.trim()
    );
}

async function signedRequest<T>(
    method: "GET" | "POST",
    requestPath: string,
    bodyObj?: unknown,
    extraHeaders?: Record<string, string>
): Promise<{ status: number; json: T | null; headers: Headers }> {
    if (!transportConfig) throw new Error("transport not configured");

    const baseUrl = sanitizeBaseUrl(transportConfig.ingestBaseUrl);
    const url = `${baseUrl}${requestPath}`;
    const body = bodyObj == null ? "" : JSON.stringify(bodyObj);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${transportConfig.connectorToken}`,
        "X-Correlation-Id": randomUUID(),
        ...(extraHeaders ?? {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        Math.max(1000, Number(transportConfig.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS))
    );

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: method === "GET" ? undefined : body,
            signal: controller.signal,
        });

        const text = await response.text();
        let parsed: T | null = null;
        if (text) {
            try {
                parsed = JSON.parse(text) as T;
            } catch {
                parsed = null;
            }
        }

        return { status: response.status, json: parsed, headers: response.headers };
    } finally {
        clearTimeout(timeout);
    }
}

async function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void processQueue();
    }, FLUSH_INTERVAL_MS);
}

async function queueItem(kind: QueueItemKind, payload: QueueItem["payload"]) {
    await loadQueueFromDisk();

    queue.push({
        id: randomUUID(),
        kind,
        createdAt: nowIso(),
        attempts: 0,
        nextAttemptAt: Date.now(),
        payload,
    });

    await persistQueue();
    await scheduleFlush();
}

function requeueWithBackoff(item: QueueItem) {
    item.attempts += 1;
    if (item.attempts > MAX_RETRIES) {
        console.error(`[ChannelScraper] Dropping outbox item after max retries: ${item.id} (${item.kind})`);
        return false;
    }

    item.nextAttemptAt = Date.now() + backoffMs(item.attempts);
    return true;
}

function takeDueItems(kind: QueueItemKind, limit: number) {
    const now = Date.now();
    const indexes: number[] = [];

    for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        if (item.kind !== kind) continue;
        if (item.nextAttemptAt > now) continue;
        indexes.push(i);
        if (indexes.length >= limit) break;
    }

    const taken: QueueItem[] = [];
    for (let i = indexes.length - 1; i >= 0; i -= 1) {
        const index = indexes[i];
        const [item] = queue.splice(index, 1);
        if (item) taken.unshift(item);
    }

    return taken;
}

async function processMessageBatch(items: QueueItem[]) {
    if (!transportConfig || items.length === 0) return;

    const payload = {
        connector_id: transportConfig.connectorId,
        tenant_key: transportConfig.tenantKey,
        sent_at: nowIso(),
        batch_id: randomUUID(),
        messages: items.map((item) => item.payload as IngestMessageEvent),
    };

    let status = 0;
    try {
        const response = await signedRequest<ApiSuccess | ApiError>("POST", "/ingest/message-batch", payload);
        status = response.status;
        if (response.status >= 200 && response.status < 300) {
            return;
        }

        if (response.status === 409) {
            return;
        }

        const bodyMessage = response.json && "message" in response.json ? response.json.message : undefined;
        throw new Error(`HTTP ${response.status}${bodyMessage ? `: ${bodyMessage}` : ""}`);
    } catch (error) {
        if (!isRetryable(status || 500)) {
            console.error("[ChannelScraper] Message batch failed with terminal error:", error);
            return;
        }

        for (const item of items) {
            if (requeueWithBackoff(item)) {
                queue.push(item);
            }
        }
    }
}

async function processSingle(kind: "thread" | "sync", item: QueueItem) {
    if (!transportConfig) return;

    const path = kind === "thread" ? "/ingest/thread" : "/ingest/channel-guild-sync";
    let status = 0;

    try {
        const response = await signedRequest<ApiSuccess | ApiError>("POST", path, {
            connector_id: transportConfig.connectorId,
            tenant_key: transportConfig.tenantKey,
            ...(item.payload as any),
        });

        status = response.status;
        if (status >= 200 && status < 300) return;
        if (status === 409) return;

        const bodyMessage = response.json && "message" in response.json ? response.json.message : undefined;
        throw new Error(`HTTP ${status}${bodyMessage ? `: ${bodyMessage}` : ""}`);
    } catch (error) {
        if (!isRetryable(status || 500)) {
            console.error(`[ChannelScraper] ${kind} event dropped (terminal error):`, error);
            return;
        }

        if (requeueWithBackoff(item)) {
            queue.push(item);
        }
    }
}

async function processQueue() {
    if (processingQueue) return;
    if (!hasConfiguredTransport()) return;

    processingQueue = true;
    try {
        await loadQueueFromDisk();

        const batchSize = Math.max(1, Number(transportConfig?.maxBatchSize ?? DEFAULT_BATCH_SIZE));
        const messageBatch = takeDueItems("message", batchSize);
        if (messageBatch.length > 0) {
            await processMessageBatch(messageBatch);
        }

        const threadItems = takeDueItems("thread", 20);
        for (const item of threadItems) {
            await processSingle("thread", item);
        }

        const syncItems = takeDueItems("sync", 5);
        for (const item of syncItems) {
            await processSingle("sync", item);
        }

        await persistQueue();

        if (queue.length > 0) {
            await scheduleFlush();
        }
    } finally {
        processingQueue = false;
    }
}

export async function configureConnectorTransport(
    _: IpcMainInvokeEvent,
    config: ConnectorTransportConfig
) {
    transportConfig = {
        ...config,
        ingestBaseUrl: sanitizeBaseUrl(config.ingestBaseUrl),
    };

    await loadQueueFromDisk();
    await scheduleFlush();

    return {
        success: hasConfiguredTransport(),
        queueDepth: queue.length,
    };
}

export async function shutdownConnectorTransport(_: IpcMainInvokeEvent) {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    await processQueue();
    await persistQueue();
    return { success: true };
}

export async function flushConnectorQueue(_: IpcMainInvokeEvent) {
    await processQueue();
    return { success: true, queueDepth: queue.length };
}

export async function enqueueMessageEvent(_: IpcMainInvokeEvent, event: IngestMessageEvent) {
    await queueItem("message", event);
    return { success: true, queueDepth: queue.length };
}

export async function enqueueThreadEvent(_: IpcMainInvokeEvent, event: IngestThreadEvent) {
    await queueItem("thread", event);
    return { success: true, queueDepth: queue.length };
}

export async function enqueueChannelGuildSync(_: IpcMainInvokeEvent, sync: IngestChannelGuildSync) {
    await queueItem("sync", sync);
    return { success: true, queueDepth: queue.length };
}

export async function fetchRuntimeConfig(
    _: IpcMainInvokeEvent,
    config: ConnectorTransportConfig,
    ifNoneMatch?: string
): Promise<FetchRuntimeConfigResult> {
    transportConfig = {
        ...config,
        ingestBaseUrl: sanitizeBaseUrl(config.ingestBaseUrl),
    };

    if (!hasConfiguredTransport()) {
        return { success: false, error: "transport config incomplete" };
    }

    const path = `/connectors/${encodeURIComponent(config.connectorId)}/runtime-config?tenant_key=${encodeURIComponent(config.tenantKey)}`;

    try {
        const response = await signedRequest<{ ok: boolean; config?: any; error?: string }>(
            "GET",
            path,
            undefined,
            ifNoneMatch ? { "If-None-Match": ifNoneMatch } : undefined
        );

        if (response.status === 304) {
            return { success: true, status: 304, etag: ifNoneMatch };
        }

        if (response.status < 200 || response.status >= 300) {
            return {
                success: false,
                status: response.status,
                error: response.json?.error || `HTTP ${response.status}`,
            };
        }

        return {
            success: true,
            status: response.status,
            etag: response.headers.get("etag") ?? undefined,
            config: response.json?.config,
        };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

export async function testIngestConnection(
    _: IpcMainInvokeEvent,
    config: ConnectorTransportConfig
) {
    const result = await fetchRuntimeConfig(_, config);
    return {
        success: result.success,
        status: result.status,
        error: result.error,
    };
}
