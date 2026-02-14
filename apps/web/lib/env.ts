export function sanitizeEnvValue(value: string): string {
  // Coolify / some .env examples often include quoted values. Fetch() cannot parse URLs with quotes.
  let v = String(value).trim();
  if (
    (v.startsWith("\"") && v.endsWith("\"") && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

