"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_ROUTE_GROUPS, CONNECTOR_SUB_NAV_TABS, getAdminNavState, getConnectorDetailSegments } from "@/lib/adminRoutes";
import { useConnectorStats } from "@/context/connector-stats-context";

type AdminNavigationProps = {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
};

function NavLink({
  href,
  label,
  isActive,
  onNavigate,
  className,
  children,
}: {
  href: string;
  label: string;
  isActive: boolean;
  onNavigate?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "admin-workspace-nav-link",
        isActive ? "admin-workspace-nav-link-active" : null,
        className,
      )}
      onClick={onNavigate}
    >
      {label}
      {children}
    </Link>
  );
}


export function AdminNavigation({ pathname, onNavigate, className }: AdminNavigationProps) {
  const state = getAdminNavState(pathname);
  const shopGroup = ADMIN_ROUTE_GROUPS.find((group) => group.id === "shop");
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");

  const connectorDetail = getConnectorDetailSegments(pathname);
  const { failedJobsByConnector } = useConnectorStats();

  const failedJobsCount = connectorDetail
    ? (failedJobsByConnector[`${connectorDetail.tenantKey}::${connectorDetail.connectorId}`] ?? 0)
    : 0;

  return (
    <nav className={cn("space-y-1", className)} aria-label="Admin workspace navigation">
      {/* Dashboard */}
      <NavLink
        href="/"
        label="Dashboard"
        isActive={state.activeItem === "dashboard"}
        onNavigate={onNavigate}
      />

      {/* CONNECTORS section */}
      <div className="pt-2">
        <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Connectors
        </p>
        <div className="space-y-1">
          <NavLink
            href="/mappings"
            label="Mappings"
            isActive={state.activeItem === "mappings"}
            onNavigate={onNavigate}
          />

          {/* Contextual sub-nav: only shown when on /mappings/[tenantKey]/[connectorId] */}
          {connectorDetail && (
            <div className="ml-3 space-y-1 border-l border-slate-700/60 pl-3">
              {CONNECTOR_SUB_NAV_TABS.map((tab) => {
                const resolvedTab = activeTab ?? "overview";
                const isTabActive = resolvedTab === tab.tabValue;
                const tabHref = `/mappings/${connectorDetail.tenantKey}/${connectorDetail.connectorId}?tab=${tab.tabValue}`;
                const isJobsTab = tab.tabValue === "jobs";
                return (
                  <Link
                    key={tab.tabValue}
                    href={tabHref}
                    className={cn(
                      "admin-workspace-nav-link flex items-center",
                      isTabActive ? "admin-workspace-nav-link-active" : null,
                    )}
                    onClick={onNavigate}
                  >
                    <span>{tab.label}</span>
                    {isJobsTab && failedJobsCount > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                        {failedJobsCount > 99 ? "99+" : failedJobsCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          <NavLink
            href="/filtering"
            label="Filtering"
            isActive={state.activeItem === "filtering"}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* DISCORD section */}
      <div className="pt-2">
        <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Discord
        </p>
        <div className="space-y-1">
          <NavLink
            href="/discord-bot"
            label="Bot Config"
            isActive={state.activeItem === "discord-bot"}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* SHOP section */}
      {shopGroup ? (
        <div className="pt-2">
          <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
            Shop
          </p>
          <div className="space-y-1">
            {shopGroup.children.map((item) => (
              <NavLink
                key={item.id}
                href={item.href}
                label={item.label}
                isActive={state.activeShopRoute === item.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

type AdminSidebarProps = {
  pathname: string;
};

export function AdminSidebar({ pathname }: AdminSidebarProps) {
  return (
    <aside className="admin-workspace-sidebar hidden lg:flex">
      <div className="admin-workspace-sidebar-inner">
        <p className="admin-chip">Admin Workspace</p>
        <h2 className="mt-3 text-base font-semibold text-slate-100">Control Plane</h2>
        <p className="mt-2 text-sm text-slate-400">
          Mappings, filtering, bot operations, and shop configuration in one workspace.
        </p>
        <Suspense fallback={null}>
          <AdminNavigation pathname={pathname} className="mt-6" />
        </Suspense>
      </div>
    </aside>
  );
}
