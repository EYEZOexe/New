import { v } from "convex/values";
import { action } from "./_generated/server";
import { mapSellLifecycleToSubscriptionStatus } from "./paymentsUtils";
import { sellRequest } from "./sellApi";

type RawInvoice = Record<string, unknown>;

type ProductAggregate = {
  productKey: string;
  title: string;
  completedSales: number;
  estimatedRevenueCents: number;
};

type CompletedInvoiceProjection = {
  createdAt: number | null;
  customerKey: string | null;
  totalCents: number;
  currency: string | null;
  products: {
    productKey: string;
    title: string;
    amountCents: number | null;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPath(payload: unknown, path: string): unknown {
  const parts = path.split(".");
  let cursor: unknown = payload;
  for (const part of parts) {
    if (Array.isArray(cursor)) {
      const index = Number.parseInt(part, 10);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
        return undefined;
      }
      cursor = cursor[index];
      continue;
    }
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function coerceString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readFirstString(payload: unknown, paths: readonly string[]): string | null {
  for (const path of paths) {
    const value = coerceString(readPath(payload, path));
    if (value) return value;
  }
  return null;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseAmountToCents(value: unknown, centsHint = false): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (centsHint) return Math.round(value);
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (centsHint) return Math.round(parsed);
  return Math.round(parsed * 100);
}

function readFirstAmountCents(
  payload: unknown,
  paths: readonly { path: string; centsHint?: boolean }[],
): number | null {
  for (const { path, centsHint } of paths) {
    const cents = parseAmountToCents(readPath(payload, path), Boolean(centsHint));
    if (cents !== null) return cents;
  }
  return null;
}

function normalizeCurrency(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function extractInvoiceStatus(invoice: RawInvoice): string | null {
  const rawStatus = readFirstString(invoice, [
    "status",
    "invoice_status",
    "payment_status",
    "state",
    "data.status",
    "data.payment_status",
  ]);
  return rawStatus ? rawStatus.trim().toLowerCase() : null;
}

function extractInvoiceCreatedAt(invoice: RawInvoice): number | null {
  return (
    parseTimestamp(
      readPath(invoice, "created_at") ??
        readPath(invoice, "createdAt") ??
        readPath(invoice, "created") ??
        readPath(invoice, "date_created") ??
        readPath(invoice, "paid_at"),
    ) ?? null
  );
}

function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function extractCustomerKey(invoice: RawInvoice): string | null {
  const email = normalizeEmail(
    readFirstString(invoice, [
      "customer_email",
      "email",
      "customer.email",
      "customer_information.email",
      "buyer.email",
      "data.customer_email",
      "data.email",
      "data.customer.email",
    ]),
  );
  if (email) return `email:${email}`;
  const customerId = readFirstString(invoice, [
    "customer_id",
    "customer.id",
    "buyer.id",
    "customer_information.id",
    "data.customer_id",
    "data.customer.id",
  ]);
  return customerId ? `customer:${customerId}` : null;
}

function extractInvoiceCurrency(invoice: RawInvoice): string | null {
  return normalizeCurrency(
    readFirstString(invoice, [
      "currency",
      "currency_code",
      "total.currency",
      "pricing.currency",
      "payment.currency",
    ]),
  );
}

function extractInvoiceTotalCents(invoice: RawInvoice): number {
  const cents =
    readFirstAmountCents(invoice, [
      { path: "total_cents", centsHint: true },
      { path: "amount_cents", centsHint: true },
      { path: "total.amount_cents", centsHint: true },
      { path: "pricing.total_cents", centsHint: true },
      { path: "total" },
      { path: "total_price" },
      { path: "amount" },
      { path: "price" },
      { path: "subtotal" },
      { path: "payment.amount" },
    ]) ?? 0;
  return Math.max(0, cents);
}

function resolveProductTitle(item: RawInvoice, fallbackKey: string): string {
  const title =
    coerceString(item.title) ??
    coerceString(item.name) ??
    coerceString(item.product_title) ??
    coerceString(item.slug) ??
    fallbackKey;
  return title;
}

function extractInvoiceProducts(invoice: RawInvoice): CompletedInvoiceProjection["products"] {
  const rows: CompletedInvoiceProjection["products"] = [];
  const productsRaw = readPath(invoice, "products");

  if (Array.isArray(productsRaw) && productsRaw.length > 0) {
    for (const product of productsRaw) {
      if (isRecord(product)) {
        const productId = coerceString(product.id) ?? coerceString(product.product_id) ?? "unknown";
        const productKey = `product:${productId}`;
        const amountCents =
          readFirstAmountCents(product, [
            { path: "total_cents", centsHint: true },
            { path: "amount_cents", centsHint: true },
            { path: "total" },
            { path: "amount" },
            { path: "price" },
          ]) ?? null;
        rows.push({
          productKey,
          title: resolveProductTitle(product, `Product #${productId}`),
          amountCents,
        });
        continue;
      }
      const asString = coerceString(product);
      if (!asString) continue;
      rows.push({
        productKey: `product:${asString}`,
        title: `Product #${asString}`,
        amountCents: null,
      });
    }
  }

  if (rows.length === 0) {
    const fallbackId =
      readFirstString(invoice, [
        "product_id",
        "product.id",
        "data.product_id",
        "data.product.id",
      ]) ?? "unknown";
    rows.push({
      productKey: `product:${fallbackId}`,
      title: `Product #${fallbackId}`,
      amountCents: null,
    });
  }

  return rows;
}

function aggregateProductRevenue(
  bucket: Map<string, ProductAggregate>,
  invoice: CompletedInvoiceProjection,
) {
  const products = invoice.products.length > 0 ? invoice.products : [
    {
      productKey: "product:unknown",
      title: "Unattributed Product",
      amountCents: null,
    },
  ];
  const explicitTotal = products.reduce(
    (sum, product) => sum + (product.amountCents ?? 0),
    0,
  );
  const splitCents =
    explicitTotal <= 0 && invoice.totalCents > 0
      ? Math.floor(invoice.totalCents / products.length)
      : 0;

  for (const product of products) {
    const existing = bucket.get(product.productKey) ?? {
      productKey: product.productKey,
      title: product.title,
      completedSales: 0,
      estimatedRevenueCents: 0,
    };
    existing.completedSales += 1;
    if (product.amountCents !== null && product.amountCents > 0) {
      existing.estimatedRevenueCents += product.amountCents;
    } else if (splitCents > 0) {
      existing.estimatedRevenueCents += splitCents;
    }
    bucket.set(product.productKey, existing);
  }
}

export const getSellStatsOverview = action({
  args: {
    periodDays: v.optional(v.number()),
    maxPages: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const periodDaysRaw = Math.floor(args.periodDays ?? 30);
    const maxPagesRaw = Math.floor(args.maxPages ?? 5);
    const periodDays = Math.min(365, Math.max(1, periodDaysRaw));
    const maxPages = Math.min(20, Math.max(1, maxPagesRaw));
    const limit = 100;
    const now = Date.now();
    const periodStart = now - periodDays * 24 * 60 * 60 * 1000;

    console.info(
      `[admin/sell-stats] load start period_days=${periodDays} max_pages=${maxPages}`,
    );

    const invoices: RawInvoice[] = [];
    let pagesFetched = 0;
    for (let page = 1; page <= maxPages; page += 1) {
      const pageRows = await sellRequest<RawInvoice[]>(
        `/invoices?page=${page}&limit=${limit}`,
        { method: "GET" },
      );
      pagesFetched += 1;
      if (!Array.isArray(pageRows) || pageRows.length === 0) break;
      invoices.push(...pageRows);
      if (pageRows.length < limit) break;
    }

    let pendingInvoices = 0;
    let refundedOrCanceledInvoices = 0;
    let completedSales = 0;
    let estimatedRevenueCents = 0;
    let latestCompletedAt: number | null = null;
    let currency: string | null = null;

    const completedInvoices: CompletedInvoiceProjection[] = [];

    for (const invoice of invoices) {
      const createdAt = extractInvoiceCreatedAt(invoice);
      if (createdAt !== null && createdAt < periodStart) {
        continue;
      }
      const rawStatus = extractInvoiceStatus(invoice);
      const lifecycle = mapSellLifecycleToSubscriptionStatus({
        rawStatus,
        eventType: "invoice",
      });
      const status = rawStatus ?? "";
      const isCompleted =
        lifecycle === "active" ||
        status.includes("paid") ||
        status.includes("complete") ||
        status.includes("success");
      const isPending =
        lifecycle === "past_due" ||
        status.includes("pending") ||
        status.includes("unpaid") ||
        status.includes("waiting");
      const isRefundedOrCanceled =
        lifecycle === "canceled" ||
        status.includes("refund") ||
        status.includes("chargeback") ||
        status.includes("cancel");

      if (isPending) pendingInvoices += 1;
      if (isRefundedOrCanceled) refundedOrCanceledInvoices += 1;
      if (!isCompleted) continue;

      const totalCents = extractInvoiceTotalCents(invoice);
      const invoiceCurrency = extractInvoiceCurrency(invoice);
      completedSales += 1;
      estimatedRevenueCents += totalCents;
      if (!currency && invoiceCurrency) currency = invoiceCurrency;
      if (createdAt !== null && (!latestCompletedAt || createdAt > latestCompletedAt)) {
        latestCompletedAt = createdAt;
      }

      completedInvoices.push({
        createdAt,
        customerKey: extractCustomerKey(invoice),
        totalCents,
        currency: invoiceCurrency,
        products: extractInvoiceProducts(invoice),
      });
    }

    completedInvoices.sort((left, right) => {
      const leftAt = left.createdAt ?? Number.MAX_SAFE_INTEGER;
      const rightAt = right.createdAt ?? Number.MAX_SAFE_INTEGER;
      return leftAt - rightAt;
    });

    const customerPurchaseCount = new Map<string, number>();
    const uniqueCustomers = new Set<string>();
    let renewalPurchases = 0;
    let firstTimePurchases = 0;
    const productTotals = new Map<string, ProductAggregate>();

    for (const invoice of completedInvoices) {
      aggregateProductRevenue(productTotals, invoice);
      const customerKey = invoice.customerKey;
      if (!customerKey) {
        firstTimePurchases += 1;
        continue;
      }
      const prior = customerPurchaseCount.get(customerKey) ?? 0;
      if (prior > 0) {
        renewalPurchases += 1;
      } else {
        firstTimePurchases += 1;
      }
      customerPurchaseCount.set(customerKey, prior + 1);
      uniqueCustomers.add(customerKey);
    }

    const topProducts = Array.from(productTotals.values())
      .sort((left, right) => {
        if (right.estimatedRevenueCents !== left.estimatedRevenueCents) {
          return right.estimatedRevenueCents - left.estimatedRevenueCents;
        }
        return right.completedSales - left.completedSales;
      })
      .slice(0, 8);

    const averageOrderValueCents =
      completedSales > 0 ? Math.round(estimatedRevenueCents / completedSales) : 0;
    const renewalRatePercent =
      completedSales > 0 ? Number(((renewalPurchases / completedSales) * 100).toFixed(2)) : 0;

    console.info(
      `[admin/sell-stats] load complete period_days=${periodDays} pages=${pagesFetched} invoices_scanned=${invoices.length} completed_sales=${completedSales} revenue_cents=${estimatedRevenueCents} renewals=${renewalPurchases} first_time=${firstTimePurchases}`,
    );

    return {
      generatedAt: now,
      periodDays,
      periodStart,
      pagesFetched,
      invoicesScanned: invoices.length,
      summary: {
        completedSales,
        estimatedRevenueCents,
        averageOrderValueCents,
        renewalPurchases,
        firstTimePurchases,
        renewalRatePercent,
        uniqueCustomers: uniqueCustomers.size,
        pendingInvoices,
        refundedOrCanceledInvoices,
        latestCompletedAt,
        currency,
      },
      topProducts,
    };
  },
});
