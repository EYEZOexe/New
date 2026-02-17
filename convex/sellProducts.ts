import { v } from "convex/values";
import { action } from "./_generated/server";

type SellProductVisibility = "PUBLIC" | "ON_HOLD" | "HIDDEN" | "PRIVATE";

type SellProductRow = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  visibility: SellProductVisibility;
  url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SellApiResponse<T> = {
  data: T;
};

function normalizeRequired(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${fieldName}_required`);
  return trimmed;
}

function getSellApiToken(): string {
  const token = process.env.SELLAPP_API_TOKEN?.trim() ?? "";
  if (!token) {
    throw new Error("sell_api_token_missing");
  }
  return token;
}

async function parseSellError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `sell_api_error_${response.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string; errors?: unknown };
    if (parsed.message && parsed.message.trim()) return parsed.message.trim();
    return `sell_api_error_${response.status}`;
  } catch {
    return `sell_api_error_${response.status}`;
  }
}

async function sellRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSellApiToken();
  const response = await fetch(`https://sell.app/api/v2${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await parseSellError(response);
    throw new Error(message);
  }

  const json = (await response.json()) as SellApiResponse<T>;
  return json.data;
}

function toSellProductRow(raw: Record<string, unknown>): SellProductRow {
  return {
    id: Number(raw.id),
    title: typeof raw.title === "string" ? raw.title : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    description: typeof raw.description === "string" ? raw.description : null,
    visibility:
      raw.visibility === "PUBLIC" ||
      raw.visibility === "ON_HOLD" ||
      raw.visibility === "HIDDEN" ||
      raw.visibility === "PRIVATE"
        ? raw.visibility
        : "PRIVATE",
    url: typeof raw.url === "string" ? raw.url : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export const listSellProducts = action({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const page = Number.isInteger(args.page) && (args.page ?? 0) > 0 ? args.page : 1;
    const limit =
      Number.isInteger(args.limit) && (args.limit ?? 0) > 0 && (args.limit ?? 0) <= 100
        ? args.limit
        : 50;

    const rows = await sellRequest<Record<string, unknown>[]>(
      `/products?page=${page}&limit=${limit}`,
      { method: "GET" },
    );
    const items = rows.map((row) => toSellProductRow(row));
    console.info(`[admin/sell-products] listed count=${items.length} page=${page} limit=${limit}`);
    return { items };
  },
});

export const createSellProduct = action({
  args: {
    title: v.string(),
    description: v.string(),
    visibility: v.optional(
      v.union(
        v.literal("PUBLIC"),
        v.literal("ON_HOLD"),
        v.literal("HIDDEN"),
        v.literal("PRIVATE"),
      ),
    ),
  },
  handler: async (_ctx, args) => {
    const title = normalizeRequired(args.title, "title");
    const description = normalizeRequired(args.description, "description");
    const visibility = args.visibility ?? "HIDDEN";

    const created = await sellRequest<Record<string, unknown>>("/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        visibility,
      }),
    });

    const row = toSellProductRow(created);
    console.info(
      `[admin/sell-products] created product id=${row.id} slug=${row.slug} visibility=${row.visibility}`,
    );
    return { product: row };
  },
});

export const updateSellProduct = action({
  args: {
    productId: v.number(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal("PUBLIC"),
        v.literal("ON_HOLD"),
        v.literal("HIDDEN"),
        v.literal("PRIVATE"),
      ),
    ),
  },
  handler: async (_ctx, args) => {
    if (!Number.isInteger(args.productId) || args.productId <= 0) {
      throw new Error("product_id_invalid");
    }

    const payload: Record<string, string> = {};
    if (typeof args.title === "string") payload.title = normalizeRequired(args.title, "title");
    if (typeof args.description === "string") {
      payload.description = normalizeRequired(args.description, "description");
    }
    if (args.visibility) payload.visibility = args.visibility;
    if (Object.keys(payload).length === 0) {
      throw new Error("update_fields_required");
    }

    const updated = await sellRequest<Record<string, unknown>>(`/products/${args.productId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const row = toSellProductRow(updated);
    console.info(
      `[admin/sell-products] updated product id=${row.id} slug=${row.slug} visibility=${row.visibility}`,
    );
    return { product: row };
  },
});
