import { v } from "convex/values";
import { action } from "./_generated/server";
import { sellRequest } from "./sellApi";

type SellProductVisibility = "PUBLIC" | "ON_HOLD" | "HIDDEN" | "PRIVATE";
type SellPaymentMethod =
  | "PAYPAL"
  | "STRIPE"
  | "CASHAPP"
  | "COINBASE"
  | "PADDLE"
  | "AUTHNET"
  | "SQUARE"
  | "BTC"
  | "LTC"
  | "ETH"
  | "XMR"
  | "BNB"
  | "TRX"
  | "MATIC"
  | "ETH_USDT"
  | "ETH_USDC"
  | "ETH_UNI"
  | "ETH_SHIB"
  | "ETH_DAI"
  | "BNB_USDT"
  | "BNB_USDC"
  | "TRX_USDT"
  | "TRX_USDC";

type SellProductRow = {
  id: number;
  uniqid: string | null;
  title: string;
  slug: string;
  description: string | null;
  visibility: SellProductVisibility;
  url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SellProductVariantRow = {
  id: number | null;
  product_id: number | null;
  uniqid: string | null;
  product_uniqid: string | null;
  title: string;
  description: string | null;
  minimum_purchase_quantity: number | null;
  maximum_purchase_quantity: number | null;
  payment_methods: SellPaymentMethod[];
  pricing: {
    type: string | null;
    humble: boolean | null;
    price: { price: number | null; currency: string | null };
  };
  deliverable: {
    types: string[];
    data: { comment: string | null; stock: number | null };
  };
  updated_at: string | null;
};

const SELL_PAYMENT_METHOD_ORDER: SellPaymentMethod[] = [
  "PAYPAL",
  "STRIPE",
  "CASHAPP",
  "COINBASE",
  "PADDLE",
  "AUTHNET",
  "SQUARE",
  "BTC",
  "LTC",
  "ETH",
  "XMR",
  "BNB",
  "TRX",
  "MATIC",
  "ETH_USDT",
  "ETH_USDC",
  "ETH_UNI",
  "ETH_SHIB",
  "ETH_DAI",
  "BNB_USDT",
  "BNB_USDC",
  "TRX_USDT",
  "TRX_USDC",
];
const SELL_PAYMENT_METHOD_SET = new Set<string>(SELL_PAYMENT_METHOD_ORDER);

function normalizeRequired(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${fieldName}_required`);
  return trimmed;
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName}_invalid`);
  }
  return value;
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName}_invalid`);
  }
  return value;
}

function normalizeSellPaymentMethods(methods: string[] | undefined): SellPaymentMethod[] {
  const cleaned = (methods ?? [])
    .map((method) => method.trim().toUpperCase())
    .filter((method) => method.length > 0 && SELL_PAYMENT_METHOD_SET.has(method));
  return cleaned as SellPaymentMethod[];
}

function getConfiguredDefaultPaymentMethods(): SellPaymentMethod[] {
  const raw = process.env.SELLAPP_DEFAULT_PAYMENT_METHODS?.trim() ?? "";
  if (!raw) return [];
  const items = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return sortSellPaymentMethods(normalizeSellPaymentMethods(items));
}

function sortSellPaymentMethods(methods: SellPaymentMethod[]): SellPaymentMethod[] {
  const unique = Array.from(new Set(methods));
  return unique.sort((a, b) => {
    const left = SELL_PAYMENT_METHOD_ORDER.indexOf(a);
    const right = SELL_PAYMENT_METHOD_ORDER.indexOf(b);
    if (left === -1 && right === -1) return a.localeCompare(b);
    if (left === -1) return 1;
    if (right === -1) return -1;
    return left - right;
  });
}

function toSellProductRow(raw: Record<string, unknown>): SellProductRow {
  const uniqid =
    (typeof raw.uniqid === "string" && raw.uniqid.trim()) ||
    (typeof raw.unique_id === "string" && raw.unique_id.trim()) ||
    (typeof raw.uniqueId === "string" && raw.uniqueId.trim()) ||
    (typeof raw.product_uniqid === "string" && raw.product_uniqid.trim()) ||
    null;
  return {
    id: Number(raw.id),
    uniqid,
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

function toSellProductVariantRow(raw: Record<string, unknown>): SellProductVariantRow {
  const pricing = raw.pricing as Record<string, unknown> | undefined;
  const pricingPrice = pricing?.price as Record<string, unknown> | undefined;
  const deliverable = raw.deliverable as Record<string, unknown> | undefined;
  const deliverableData = deliverable?.data as Record<string, unknown> | undefined;
  const paymentMethods = Array.isArray(raw.payment_methods)
    ? raw.payment_methods.filter((value): value is SellPaymentMethod => typeof value === "string")
    : [];
  return {
    id: typeof raw.id === "number" ? raw.id : Number.isFinite(Number(raw.id)) ? Number(raw.id) : null,
    product_id:
      typeof raw.product_id === "number"
        ? raw.product_id
        : Number.isFinite(Number(raw.product_id))
          ? Number(raw.product_id)
          : null,
    uniqid:
      typeof raw.uniqid === "string"
        ? raw.uniqid
        : typeof raw.unique_id === "string"
          ? raw.unique_id
          : null,
    product_uniqid:
      typeof raw.product_uniqid === "string" ? raw.product_uniqid : null,
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : null,
    minimum_purchase_quantity:
      typeof raw.minimum_purchase_quantity === "number"
        ? raw.minimum_purchase_quantity
        : null,
    maximum_purchase_quantity:
      typeof raw.maximum_purchase_quantity === "number"
        ? raw.maximum_purchase_quantity
        : null,
    payment_methods: paymentMethods,
    pricing: {
      type: typeof pricing?.type === "string" ? pricing.type : null,
      humble: typeof pricing?.humble === "boolean" ? pricing.humble : null,
      price: {
        price:
          typeof pricingPrice?.price === "number"
            ? pricingPrice.price
            : typeof pricingPrice?.price === "string"
              ? Number.parseInt(pricingPrice.price, 10)
              : null,
        currency: typeof pricingPrice?.currency === "string" ? pricingPrice.currency : null,
      },
    },
    deliverable: {
      types: Array.isArray(deliverable?.types)
        ? deliverable.types.filter((value): value is string => typeof value === "string")
        : [],
      data: {
        comment: typeof deliverableData?.comment === "string" ? deliverableData.comment : null,
        stock: typeof deliverableData?.stock === "number" ? deliverableData.stock : null,
      },
    },
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

async function collectPaymentMethodsForProductToken(token: string): Promise<SellPaymentMethod[]> {
  const variantRows = await sellRequest<Record<string, unknown>[]>(
    `/products/${token}/variants?page=1&limit=100`,
    { method: "GET" },
  );
  const discovered: SellPaymentMethod[] = [];
  for (const variantRaw of variantRows) {
    const variant = toSellProductVariantRow(variantRaw);
    discovered.push(...variant.payment_methods);
  }
  return sortSellPaymentMethods(discovered);
}

async function discoverStorePaymentMethods(args?: {
  productId?: number;
  productSlug?: string;
  productUniqid?: string;
}): Promise<SellPaymentMethod[]> {
  const discovered = new Set<SellPaymentMethod>();
  const preferredCandidates = [
    args?.productUniqid?.trim() ?? "",
    typeof args?.productId === "number" && args.productId > 0 ? String(args.productId) : "",
    args?.productSlug?.trim() ?? "",
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  for (const token of preferredCandidates) {
    try {
      const methods = await collectPaymentMethodsForProductToken(token);
      for (const method of methods) discovered.add(method);
      if (discovered.size > 0) {
        return sortSellPaymentMethods(Array.from(discovered));
      }
    } catch {
      // Try next candidate token.
    }
  }

  const products = await sellRequest<Record<string, unknown>[]>("/products?page=1&limit=100", {
    method: "GET",
  });
  for (const productRaw of products) {
    const product = toSellProductRow(productRaw);
    const candidates = [product.uniqid ?? "", String(product.id), product.slug].filter(
      (value, index, list) => value && list.indexOf(value) === index,
    );
    for (const token of candidates) {
      try {
        const methods = await collectPaymentMethodsForProductToken(token);
        for (const method of methods) discovered.add(method);
      } catch {
        // Continue probing additional products/tokens.
      }
    }
  }
  return sortSellPaymentMethods(Array.from(discovered));
}

async function resolveProductVariantToken(args: {
  productId: number;
  productSlug?: string;
  productUniqid?: string;
}): Promise<string> {
  const candidates = [args.productUniqid?.trim() ?? ""].filter(Boolean);
  try {
    const products = await sellRequest<Record<string, unknown>[]>(
      "/products?page=1&limit=100",
      {
        method: "GET",
      },
    );
    const slug = args.productSlug?.trim() ?? "";
    const match = products.map((raw) => toSellProductRow(raw)).find((row) => {
      if (row.id === args.productId) return true;
      if (slug && row.slug === slug) return true;
      return false;
    });
    if (match?.uniqid) {
      candidates.push(match.uniqid);
    }
  } catch {
    // Ignore discovery failures and fall back to id/slug probes.
  }
  candidates.push(String(args.productId));
  if (args.productSlug?.trim()) {
    candidates.push(args.productSlug.trim());
  }
  const uniqueCandidates = candidates.filter(
    (value, index, list) => value && list.indexOf(value) === index,
  );

  let lastError = "product_variant_token_not_found";
  for (const token of uniqueCandidates) {
    try {
      await sellRequest<Record<string, unknown>[]>(
        `/products/${token}/variants?page=1&limit=1`,
        { method: "GET" },
      );
      return token;
    } catch (error) {
      const text = error instanceof Error ? error.message : "unknown_token_probe_error";
      lastError = text;
      if (!text.includes("No query results for model [App\\Models\\Listing].")) {
        throw error;
      }
    }
  }

  throw new Error(lastError);
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

export const listSellPaymentMethods = action({
  args: {
    productId: v.optional(v.number()),
    productSlug: v.optional(v.string()),
    productUniqid: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const configuredDefaults = getConfiguredDefaultPaymentMethods();
    try {
      const discovered = await discoverStorePaymentMethods({
        productId: args.productId,
        productSlug: args.productSlug,
        productUniqid: args.productUniqid,
      });
      const items = discovered.length > 0 ? discovered : configuredDefaults;
      const source =
        discovered.length > 0
          ? "api"
          : configuredDefaults.length > 0
            ? "env_default"
            : "none";
      console.info(
        `[admin/sell-products] listed payment methods count=${items.length} source=${source} preferred_product_id=${args.productId ?? "none"}`,
      );
      return { items };
    } catch (error) {
      const text = error instanceof Error ? error.message : "unknown_sell_payment_methods_error";
      console.error(`[admin/sell-products] list payment methods failed: ${text}`);
      if (configuredDefaults.length > 0) {
        console.info(
          `[admin/sell-products] using configured default payment methods count=${configuredDefaults.length}`,
        );
      }
      return { items: configuredDefaults };
    }
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

export const upsertSellProductVariant = action({
  args: {
    productId: v.number(),
    productSlug: v.optional(v.string()),
    productUniqid: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    priceCents: v.number(),
    currency: v.optional(v.string()),
    paymentMethods: v.optional(v.array(v.string())),
    minimumPurchaseQuantity: v.optional(v.number()),
    maximumPurchaseQuantity: v.optional(v.number()),
    manualComment: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    try {
      const productId = normalizePositiveInteger(args.productId, "product_id");
      const productSlug = args.productSlug?.trim() ?? "";
      const productToken = await resolveProductVariantToken({
        productId,
        productSlug,
        productUniqid: args.productUniqid,
      });
      const title = normalizeRequired(args.title, "title");
      const description = normalizeRequired(args.description, "description");
      const priceCents = normalizeNonNegativeInteger(args.priceCents, "price_cents");
      const currency = (args.currency ?? "USD").trim().toUpperCase();
      const providedPaymentMethods = normalizeSellPaymentMethods(args.paymentMethods);
      const configuredDefaults = getConfiguredDefaultPaymentMethods();
      let discoveredPaymentMethods: SellPaymentMethod[] = [];
      if (providedPaymentMethods.length === 0) {
        try {
          discoveredPaymentMethods = await discoverStorePaymentMethods({
            productId,
            productSlug,
            productUniqid: args.productUniqid,
          });
        } catch (error) {
          const text =
            error instanceof Error ? error.message : "unknown_sell_payment_discovery_error";
          console.error(`[admin/sell-products] payment methods discovery failed: ${text}`);
        }
      }
      const paymentMethods =
        providedPaymentMethods.length > 0
          ? providedPaymentMethods
          : discoveredPaymentMethods.length > 0
            ? discoveredPaymentMethods
            : configuredDefaults;
      const minimumPurchaseQuantity = normalizePositiveInteger(
        args.minimumPurchaseQuantity ?? 1,
        "minimum_purchase_quantity",
      );
      const maximumPurchaseQuantity =
        typeof args.maximumPurchaseQuantity === "number"
          ? normalizePositiveInteger(args.maximumPurchaseQuantity, "maximum_purchase_quantity")
          : null;
      const manualComment =
        args.manualComment?.trim() ||
        "Delivery is fulfilled manually after purchase confirmation.";
      const existingRows = await sellRequest<Record<string, unknown>[]>(
        `/products/${productToken}/variants?page=1&limit=100`,
        { method: "GET" },
      );
      const existing = existingRows
        .map((row) => toSellProductVariantRow(row))
        .find((row) => row.title.toLowerCase() === title.toLowerCase());

      const payload: Record<string, unknown> = {
        title,
        description,
        deliverable: {
          data: {
            comment: manualComment,
          },
          types: ["MANUAL"],
        },
        pricing: {
          humble: false,
          price: {
            price: String(priceCents),
            currency,
          },
        },
        minimum_purchase_quantity: minimumPurchaseQuantity,
      };
      if (paymentMethods.length > 0) {
        payload.payment_methods = paymentMethods;
      }
      if (maximumPurchaseQuantity !== null) {
        payload.maximum_purchase_quantity = maximumPurchaseQuantity;
      }

      const existingId =
        typeof existing?.id === "number" && existing.id > 0 ? existing.id : null;
      const method = existingId ? "PATCH" : "POST";
      const path = existingId
        ? `/products/${productToken}/variants/${existingId}`
        : `/products/${productToken}/variants`;
      console.info(
        `[admin/sell-products] variant request method=${method} path=${path} payload=${JSON.stringify(payload)}`,
      );
      const raw = await sellRequest<Record<string, unknown>>(path, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const variant = toSellProductVariantRow(raw);
      console.info(
        `[admin/sell-products] upsert variant mode=${existing ? "update" : "create"} product=${productId} product_token=${productToken} variant_uniqid=${variant.uniqid ?? "none"} title=${variant.title} price_cents=${priceCents}`,
      );
      return { ok: true as const, variant };
    } catch (error) {
      const text = error instanceof Error ? error.message : "unknown_sell_variant_error";
      console.error(`[admin/sell-products] upsert variant failed: ${text}`);
      return { ok: false as const, error: text };
    }
  },
});
