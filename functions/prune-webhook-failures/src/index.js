function requiredEnv(env, name) {
  const value = env?.[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optionalEnv(env, name, fallback) {
  return env?.[name] || fallback;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildHeaders({ projectId, apiKey }) {
  return {
    "Content-Type": "application/json",
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Key": apiKey
  };
}

async function appwriteFetchJson({ endpoint, projectId, apiKey, method, path, fetchImpl = fetch }) {
  const url = `${String(endpoint).replace(/\/$/, "")}${path}`;
  const res = await fetchImpl(url, {
    method,
    headers: buildHeaders({ projectId, apiKey })
  });
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;
  if (res.ok) return data;

  const err = new Error((data && data.message) || `Appwrite error ${res.status} on ${method} ${path}`);
  err.status = res.status;
  err.response = data;
  throw err;
}

export function buildPruneQueries({ cutoffIso, limit = 200 } = {}) {
  // Appwrite query syntax (string form) used by REST APIs.
  return [
    `lessThan(\"$createdAt\",\"${cutoffIso}\")`,
    `orderAsc(\"$createdAt\")`,
    `limit(${limit})`
  ];
}

function toQueryString(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) usp.append(k, String(item));
      continue;
    }
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function pruneOnce({ endpoint, projectId, apiKey, databaseId, collectionId, cutoffIso, limit, fetchImpl }) {
  const queries = buildPruneQueries({ cutoffIso, limit });
  try {
    return await appwriteFetchJson({
      endpoint,
      projectId,
      apiKey,
      method: "DELETE",
      fetchImpl,
      path: `/databases/${databaseId}/collections/${collectionId}/documents${toQueryString({
        "queries[]": queries
      })}`
    });
  } catch (err) {
    // If some self-hosted versions are picky about query combos, retry with only the cutoff filter.
    if (err?.status !== 400) throw err;
    return await appwriteFetchJson({
      endpoint,
      projectId,
      apiKey,
      method: "DELETE",
      fetchImpl,
      path: `/databases/${databaseId}/collections/${collectionId}/documents${toQueryString({
        "queries[]": [`lessThan(\"$createdAt\",\"${cutoffIso}\")`]
      })}`
    });
  }
}

export function createHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async ({ req, res, log, error }) => {
    try {
      // eslint-disable-next-line no-unused-vars
      const _ = req;

      const endpoint = requiredEnv(env, "APPWRITE_ENDPOINT");
      const projectId = requiredEnv(env, "APPWRITE_PROJECT_ID");
      const apiKey = requiredEnv(env, "APPWRITE_API_KEY");

      const databaseId = optionalEnv(env, "APPWRITE_DATABASE_ID", "crypto");
      const collectionId = optionalEnv(env, "APPWRITE_WEBHOOK_FAILURES_COLLECTION_ID", "webhook_failures");
      const retentionDays = Number(optionalEnv(env, "WEBHOOK_FAILURE_RETENTION_DAYS", "7"));
      const limit = Number(optionalEnv(env, "WEBHOOK_FAILURE_PRUNE_LIMIT", "200"));

      const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      let deletedTotal = 0;
      for (let i = 0; i < 20; i++) {
        const out = await pruneOnce({
          endpoint,
          projectId,
          apiKey,
          databaseId,
          collectionId,
          cutoffIso,
          limit,
          fetchImpl
        });
        const n = Number(out?.total || 0);
        deletedTotal += n;
        if (n === 0) break;
      }

      log(`prune-webhook-failures: deletedTotal=${deletedTotal}`);
      return res.json({ ok: true, deletedTotal, cutoffIso });
    } catch (err) {
      const msg = err?.message ?? String(err);
      log(`prune-webhook-failures: internal_error: ${msg}`);
      if (err?.status) log(`prune-webhook-failures: internal_error_status: ${err.status}`);
      if (err?.response?.type) log(`prune-webhook-failures: internal_error_type: ${err.response.type}`);
      error(msg);
      return res.json({ ok: false, error: "internal_error" });
    }
  };
}

export default createHandler();
