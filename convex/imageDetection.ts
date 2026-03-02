const IMAGE_EXTENSION_PATTERN =
  /\.(?:png|jpe?g|webp|gif|bmp|tiff?|avif|heic|heif|svg)$/i;

const IMAGE_FORMAT_PATTERN = /^(?:png|jpe?g|webp|gif|bmp|tiff?|avif|svg)$/i;

export function normalizeContentType(value?: string | null): string {
  if (!value) return "";
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

function hasImagePathExtension(value: string): boolean {
  return IMAGE_EXTENSION_PATTERN.test(value);
}

function hasImageFormatParam(value: string | null): boolean {
  if (!value) return false;
  return IMAGE_FORMAT_PATTERN.test(value.trim());
}

export function isLikelyImageUrl(url: string): boolean {
  const normalized = url.trim();
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (hasImagePathExtension(parsed.pathname.toLowerCase())) {
      return true;
    }

    const format =
      parsed.searchParams.get("format") ??
      parsed.searchParams.get("fm") ??
      parsed.searchParams.get("ext");
    return hasImageFormatParam(format);
  } catch {
    const fallback = normalized.toLowerCase();
    return /(?:\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?|\.avif|\.svg)(?:$|[?#])/i.test(
      fallback,
    );
  }
}

export function isLikelyImageAttachment(args: {
  url?: string | null;
  contentType?: string | null;
  name?: string | null;
}): boolean {
  if (normalizeContentType(args.contentType).startsWith("image/")) {
    return true;
  }

  const name = args.name?.trim().toLowerCase() ?? "";
  if (name && hasImagePathExtension(name)) {
    return true;
  }

  const url = args.url?.trim() ?? "";
  return isLikelyImageUrl(url);
}
