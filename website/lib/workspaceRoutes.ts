export type WorkspaceNavKey =
  | "overview"
  | "markets"
  | "live-intel"
  | "signals"
  | "indicators"
  | "strategies"
  | "journal"
  | "news";

type WorkspaceRoute = {
  key: WorkspaceNavKey;
  href: string;
  label: string;
};

export const workspaceRoutes: WorkspaceRoute[] = [
  { key: "overview", href: "/workspace/overview", label: "Overview" },
  { key: "markets", href: "/workspace/markets", label: "Markets" },
  { key: "live-intel", href: "/workspace/live-intel", label: "Live Intel" },
  { key: "signals", href: "/workspace/signals", label: "Signals & Alerts" },
  { key: "indicators", href: "/workspace/indicators", label: "Indicators" },
  { key: "strategies", href: "/workspace/strategies", label: "Strategies" },
  { key: "journal", href: "/workspace/journal", label: "Trading Journal" },
  { key: "news", href: "/workspace/news", label: "News" },
];

export type WorkspaceNavState = {
  normalizedPath: string;
  activeKey: WorkspaceNavKey;
};

export function normalizeWorkspacePath(pathname: string): string {
  const cleanPath = pathname.split("?")[0] ?? pathname;
  if (cleanPath === "/dashboard") {
    return "/workspace/overview";
  }
  return cleanPath;
}

export function getWorkspaceNavState(pathname: string): WorkspaceNavState {
  const normalizedPath = normalizeWorkspacePath(pathname);

  const matchedRoute =
    workspaceRoutes.find((route) => normalizedPath === route.href || normalizedPath.startsWith(`${route.href}/`)) ??
    workspaceRoutes[0];

  return {
    normalizedPath,
    activeKey: matchedRoute.key,
  };
}

