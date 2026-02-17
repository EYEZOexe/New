"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminMobileNav } from "./admin-mobile-nav";
import { AdminSidebar } from "./admin-sidebar";

type AdminShellProps = {
  children: ReactNode;
  headerSlot?: ReactNode;
};

export function AdminShell({ children, headerSlot }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="admin-workspace">
      <AdminSidebar pathname={pathname} />
      <div className="admin-workspace-main">
        <header className="admin-workspace-topbar">
          <div className="admin-workspace-topbar-inner">
            <div className="flex items-center gap-3">
              <AdminMobileNav pathname={pathname} />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Operations
                </p>
                <p className="text-sm font-semibold text-slate-100">Admin Workspace</p>
              </div>
            </div>
            {headerSlot}
          </div>
        </header>
        <main className="admin-workspace-content">{children}</main>
      </div>
    </div>
  );
}
