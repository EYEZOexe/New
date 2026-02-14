export function parseRoleIdsJson(text: string): string[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

export function computeDesiredRoleIds(opts: {
  subscriptionStatus: string | null;
  plan: string | null;
  mappingDocs: Array<{ plan?: string | null; roleIdsJson?: string | null }>;
}): string[] {
  if (opts.subscriptionStatus !== "active") return [];
  if (!opts.plan) return [];

  const doc = opts.mappingDocs.find((d) => d?.plan === opts.plan);
  if (!doc?.roleIdsJson) return [];

  return parseRoleIdsJson(doc.roleIdsJson);
}

