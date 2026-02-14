function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function toQueryString(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) usp.append(key, String(item));
      continue;
    }
    usp.set(key, String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function createAppwriteRestClient({ endpoint, projectId, apiKey, fetchImpl = fetch }) {
  const base = String(endpoint).replace(/\/$/, "");

  async function requestJson({ method, path, body }) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await res.text();
    const data = text ? safeJsonParse(text) : null;
    if (res.ok) return data;

    const err = new Error((data && data.message) || `Appwrite error ${res.status} on ${method} ${path}`);
    err.status = res.status;
    err.response = data;
    throw err;
  }

  return {
    listUsers: ({ search }) =>
      requestJson({
        method: "GET",
        path: `/users${toQueryString({ search })}`
      }),

    listMemberships: ({ teamId, queries, search }) =>
      requestJson({
        method: "GET",
        path: `/teams/${teamId}/memberships${toQueryString({
          "queries[]": queries,
          search
        })}`
      }),

    createMembership: ({ teamId, roles, userId, name, url }) =>
      requestJson({
        method: "POST",
        path: `/teams/${teamId}/memberships`,
        body: { roles, userId, name, url }
      }),

    deleteMembership: ({ teamId, membershipId }) =>
      requestJson({
        method: "DELETE",
        path: `/teams/${teamId}/memberships/${membershipId}`
      }),

    createDocument: ({ databaseId, collectionId, documentId, data }) =>
      requestJson({
        method: "POST",
        path: `/databases/${databaseId}/collections/${collectionId}/documents`,
        body: { documentId, data }
      }),

    upsertDocumentPut: ({ databaseId, collectionId, documentId, data }) =>
      requestJson({
        method: "PUT",
        path: `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
        body: { data }
      })
  };
}

