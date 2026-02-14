function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function joinPath(endpoint: string, path: string) {
  return `${endpoint.replace(/\/$/, "")}${path}`;
}

type AdminClientParams = {
  endpoint: string;
  projectId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
};

export function createAppwriteAdminRestClient(params: AdminClientParams) {
  const fetchImpl = params.fetchImpl ?? fetch;

  async function requestJson<T>(
    path: string,
    init: RequestInit & { jsonBody?: unknown } = {}
  ): Promise<T> {
    const res = await fetchImpl(joinPath(params.endpoint, path), {
      ...init,
      headers: {
        ...(init.jsonBody !== undefined ? { "content-type": "application/json" } : {}),
        "X-Appwrite-Project": params.projectId,
        "X-Appwrite-Key": params.apiKey,
        ...(init.headers ?? {})
      },
      body:
        init.jsonBody === undefined
          ? init.body
          : typeof init.jsonBody === "string"
            ? (init.jsonBody as string)
            : JSON.stringify(init.jsonBody)
    });

    const text = await res.text();
    const data = text ? safeJsonParse(text) : null;

    if (res.ok) return data as T;

    const message =
      (data as any)?.message || `Appwrite error ${res.status} on ${init.method || "GET"} ${path}`;
    const err: any = new Error(message);
    err.code = res.status;
    err.type = (data as any)?.type;
    err.response = data;
    throw err;
  }

  return {
    async getDocument(opts: { databaseId: string; collectionId: string; documentId: string }) {
      return await requestJson<any>(
        `/databases/${encodeURIComponent(opts.databaseId)}/collections/${encodeURIComponent(
          opts.collectionId
        )}/documents/${encodeURIComponent(opts.documentId)}`,
        { method: "GET" }
      );
    },

    async listDocuments(opts: {
      databaseId: string;
      collectionId: string;
      limit?: number;
      offset?: number;
    }) {
      const qs = new URLSearchParams();
      if (typeof opts.limit === "number") qs.set("limit", String(opts.limit));
      if (typeof opts.offset === "number") qs.set("offset", String(opts.offset));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";

      return await requestJson<any>(
        `/databases/${encodeURIComponent(opts.databaseId)}/collections/${encodeURIComponent(
          opts.collectionId
        )}/documents${suffix}`,
        { method: "GET" }
      );
    },

    async upsertDocumentPut(opts: {
      databaseId: string;
      collectionId: string;
      documentId: string;
      data: Record<string, unknown>;
    }) {
      return await requestJson<any>(
        `/databases/${encodeURIComponent(opts.databaseId)}/collections/${encodeURIComponent(
          opts.collectionId
        )}/documents/${encodeURIComponent(opts.documentId)}`,
        { method: "PUT", jsonBody: { data: opts.data } }
      );
    }
  };
}

