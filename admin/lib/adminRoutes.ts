export type AdminNavItem = "dashboard" | "mappings" | "filtering" | "discord-bot";
export type AdminNavGroup = "connectors" | "shop";
export type AdminShopRoute = "catalog" | "policies" | "customers" | "statistics";

type AdminRouteConfig = {
  id: AdminNavItem;
  href: string;
};

type AdminRouteGroupConfig = {
  id: AdminNavGroup;
  href: string;
  children: readonly {
    id: AdminShopRoute;
    href: string;
    label: string;
  }[];
};

export type AdminNavState = {
  activeItem: AdminNavItem | null;
  activeGroup: AdminNavGroup | null;
  activeShopRoute: AdminShopRoute | null;
};

// NOTE: "dashboard" is intentionally omitted from this list and is handled as a special case
// in getAdminNavState (see root route check). This ensures the root "/" route returns
// activeItem: "dashboard" without relying on route matching logic.
export const ADMIN_ROUTE_ITEMS: readonly AdminRouteConfig[] = [
  { id: "mappings", href: "/mappings" },
  { id: "filtering", href: "/filtering" },
  { id: "discord-bot", href: "/discord-bot" },
] as const;

export const CONNECTOR_SUB_NAV_TABS = [
  { label: "Overview", tabValue: "overview" },
  { label: "Routes", tabValue: "routes" },
  { label: "Jobs", tabValue: "jobs" },
  { label: "Settings", tabValue: "settings" },
] as const;

export const ADMIN_ROUTE_GROUPS: readonly AdminRouteGroupConfig[] = [
  {
    id: "shop",
    href: "/shop",
    children: [
      { id: "catalog", href: "/shop/catalog", label: "Catalog" },
      { id: "policies", href: "/shop/policies", label: "Policies" },
      { id: "customers", href: "/shop/customers", label: "Customers" },
      { id: "statistics", href: "/shop/statistics", label: "Statistics" },
    ],
  },
] as const;

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (trimmed.length === 0) return "/";

  const noQuery = trimmed.split(/[?#]/, 1)[0] ?? "";
  if (noQuery === "") return "/";
  if (noQuery === "/") return "/";

  const withLeadingSlash = noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

function isPathWithinRoute(pathname: string, routePrefix: string): boolean {
  if (pathname === routePrefix) return true;
  return pathname.startsWith(`${routePrefix}/`);
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const CONNECTOR_ITEMS = new Set<AdminNavItem>(["mappings", "filtering"]);

export function getAdminNavState(pathname: string): AdminNavState {
  const normalizedPath = normalizePathname(pathname);

  // Root route
  if (normalizedPath === "/") {
    return {
      activeItem: "dashboard",
      activeGroup: null,
      activeShopRoute: null,
    };
  }

  const activeItem =
    ADMIN_ROUTE_ITEMS.find((item) => isPathWithinRoute(normalizedPath, item.href))?.id ?? null;

  // Check if path is within connectors routes (mappings or filtering)
  const isConnectorPath = activeItem !== null && CONNECTOR_ITEMS.has(activeItem);
  const activeGroup = isConnectorPath
    ? "connectors"
    : ADMIN_ROUTE_GROUPS.find((group) => isPathWithinRoute(normalizedPath, group.href))?.id ?? null;

  const activeShopRoute =
    ADMIN_ROUTE_GROUPS.find((group) => group.id === "shop")
      ?.children.find((route) => isPathWithinRoute(normalizedPath, route.href))?.id ?? null;

  return {
    activeItem,
    activeGroup,
    activeShopRoute,
  };
}

export function buildAdminBreadcrumbs(pathname: string): string[] {
  const normalizedPath = normalizePathname(pathname);
  const [head, ...rest] = normalizedPath.split("/").filter(Boolean);

  // Root route
  if (!head) return [];

  if (head === "mappings") {
    const breadcrumbs = ["Mappings"];
    if (rest.length >= 2) {
      breadcrumbs.push(decodePathSegment(rest[0]));
      breadcrumbs.push(decodePathSegment(rest[1]));

      // Extract tab query parameter from original pathname.
      // We use the raw pathname here (rather than normalizedPath) because query parameters
      // are removed during normalization, so we must extract the tab from the original string.
      // Path segments are split from normalizedPath since they've been canonicalized.
      const tabMatch = pathname.match(/[?&]tab=([^&]+)/);
      if (tabMatch) {
        const tabValue = decodePathSegment(tabMatch[1]);
        const tabLabel = CONNECTOR_SUB_NAV_TABS.find((tab) => tab.tabValue === tabValue)?.label;
        if (tabLabel) {
          breadcrumbs.push(tabLabel);
        }
      }
    }
    return breadcrumbs;
  }

  if (head === "discord-bot") {
    return ["Discord Bot"];
  }

  if (head === "filtering") {
    return ["Filtering"];
  }

  if (head === "shop") {
    const labelByRoute: Record<AdminShopRoute, string> = {
      catalog: "Catalog",
      policies: "Policies",
      customers: "Customers",
      statistics: "Statistics",
    };

    const route = rest[0];
    if (
      route === "catalog" ||
      route === "policies" ||
      route === "customers" ||
      route === "statistics"
    ) {
      return ["Shop", labelByRoute[route]];
    }
    return ["Shop"];
  }

  return [];
}
