export type AdminNavItem = "mappings" | "discord-bot";
export type AdminNavGroup = "shop";

type AdminRouteConfig = {
  id: AdminNavItem;
  href: string;
};

type AdminRouteGroupConfig = {
  id: AdminNavGroup;
  href: string;
};

export type AdminNavState = {
  activeItem: AdminNavItem | null;
  activeGroup: AdminNavGroup | null;
};

export const ADMIN_ROUTE_ITEMS: readonly AdminRouteConfig[] = [
  { id: "mappings", href: "/mappings" },
  { id: "discord-bot", href: "/discord-bot" },
] as const;

export const ADMIN_ROUTE_GROUPS: readonly AdminRouteGroupConfig[] = [
  { id: "shop", href: "/shop" },
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

export function getAdminNavState(pathname: string): AdminNavState {
  const normalizedPath = normalizePathname(pathname);

  const activeItem =
    ADMIN_ROUTE_ITEMS.find((item) => isPathWithinRoute(normalizedPath, item.href))?.id ?? null;
  const activeGroup =
    ADMIN_ROUTE_GROUPS.find((group) => isPathWithinRoute(normalizedPath, group.href))?.id ?? null;

  return {
    activeItem,
    activeGroup,
  };
}
