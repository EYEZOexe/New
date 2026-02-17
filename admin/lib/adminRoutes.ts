export type AdminNavItem = "mappings" | "discord-bot";
export type AdminNavGroup = "shop";
export type AdminShopRoute = "catalog" | "policies" | "customers";

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

export const ADMIN_ROUTE_ITEMS: readonly AdminRouteConfig[] = [
  { id: "mappings", href: "/mappings" },
  { id: "discord-bot", href: "/discord-bot" },
] as const;

export const ADMIN_ROUTE_GROUPS: readonly AdminRouteGroupConfig[] = [
  {
    id: "shop",
    href: "/shop",
    children: [
      { id: "catalog", href: "/shop/catalog", label: "Catalog" },
      { id: "policies", href: "/shop/policies", label: "Policies" },
      { id: "customers", href: "/shop/customers", label: "Customers" },
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

export function getAdminNavState(pathname: string): AdminNavState {
  const normalizedPath = normalizePathname(pathname);

  const activeItem =
    ADMIN_ROUTE_ITEMS.find((item) => isPathWithinRoute(normalizedPath, item.href))?.id ?? null;
  const activeGroup =
    ADMIN_ROUTE_GROUPS.find((group) => isPathWithinRoute(normalizedPath, group.href))?.id ?? null;
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

  if (!head) return [];

  if (head === "mappings") {
    if (rest.length >= 2) {
      return ["Mappings", decodePathSegment(rest[0]), decodePathSegment(rest[1])];
    }
    return ["Mappings"];
  }

  if (head === "discord-bot") {
    return ["Discord Bot"];
  }

  if (head === "shop") {
    const labelByRoute: Record<AdminShopRoute, string> = {
      catalog: "Catalog",
      policies: "Policies",
      customers: "Customers",
    };

    const route = rest[0];
    if (route === "catalog" || route === "policies" || route === "customers") {
      return ["Shop", labelByRoute[route]];
    }
    return ["Shop"];
  }

  return [];
}
