"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ADMIN_ROUTE_GROUPS, getAdminNavState } from "@/lib/adminRoutes";

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
}: {
  href: string;
  label: string;
  isActive: boolean;
  onNavigate?: () => void;
  className?: string;
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
    </Link>
  );
}

export function AdminNavigation({ pathname, onNavigate, className }: AdminNavigationProps) {
  const state = getAdminNavState(pathname);
  const shopGroup = ADMIN_ROUTE_GROUPS.find((group) => group.id === "shop");

  return (
    <nav className={cn("space-y-2", className)} aria-label="Admin workspace navigation">
      <NavLink
        href="/mappings"
        label="Mappings"
        isActive={state.activeItem === "mappings"}
        onNavigate={onNavigate}
      />
      <NavLink
        href="/discord-bot"
        label="Discord Bot"
        isActive={state.activeItem === "discord-bot"}
        onNavigate={onNavigate}
      />

      {shopGroup ? (
        <div className="pt-3">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Shop</p>
          <div className="mt-2 space-y-1">
            {shopGroup.children.map((item) => (
              <NavLink
                key={item.id}
                href={item.href}
                label={item.label}
                isActive={state.activeShopRoute === item.id}
                onNavigate={onNavigate}
                className="pl-4"
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
          Mappings, bot operations, and shop configuration in one workspace.
        </p>
        <AdminNavigation pathname={pathname} className="mt-6" />
      </div>
    </aside>
  );
}
