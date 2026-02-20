export function sanitizeAppRedirectPath(
  rawPath: string | null | undefined,
  fallbackPath = "/dashboard",
): string {
  const path = (rawPath ?? "").trim();
  if (!path) return fallbackPath;
  if (!path.startsWith("/")) return fallbackPath;
  if (path.startsWith("//")) return fallbackPath;
  if (path.includes("\r") || path.includes("\n")) return fallbackPath;
  return path;
}
