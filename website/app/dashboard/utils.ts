import type { SignalAttachment, SubscriptionTier } from "./types";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const IMAGE_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME_PREFIXES = ["image/", "video/", "audio/", "text/"];
const ALLOWED_ATTACHMENT_MIME_EXACT = new Set(["application/pdf"]);
const BLOCKED_ATTACHMENT_MIME_PREFIXES = [
  "application/x-msdownload",
  "application/x-dosexec",
  "application/x-msi",
  "application/vnd.microsoft.portable-executable",
];
const TIER_ORDER: SubscriptionTier[] = ["basic", "advanced", "pro"];

export function tierRank(tier: SubscriptionTier | null | undefined): number {
  if (!tier) return -1;
  return TIER_ORDER.indexOf(tier);
}

export function formatRemainingMs(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferMimeFromUrl(url: string): string | null {
  const normalized = url.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".bmp")) return "image/bmp";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  return null;
}

export function classifyAttachment(attachment: SignalAttachment) {
  const contentType = (attachment.contentType ?? "").trim().toLowerCase();
  const inferred = inferMimeFromUrl(attachment.url);
  const normalizedType = contentType || inferred || "";

  const isBlockedType = BLOCKED_ATTACHMENT_MIME_PREFIXES.some((prefix) =>
    normalizedType.startsWith(prefix),
  );
  const isAllowedType =
    !normalizedType ||
    ALLOWED_ATTACHMENT_MIME_EXACT.has(normalizedType) ||
    ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) => normalizedType.startsWith(prefix));
  const isOversized = typeof attachment.size === "number" && attachment.size > MAX_ATTACHMENT_BYTES;
  const isImage = normalizedType.startsWith("image/");
  const canPreviewImage =
    isImage &&
    !isBlockedType &&
    !isOversized &&
    (typeof attachment.size !== "number" || attachment.size <= IMAGE_PREVIEW_MAX_BYTES);

  return {
    normalizedType,
    isBlockedType,
    isAllowedType,
    isOversized,
    canPreviewImage,
  };
}
