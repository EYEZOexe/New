import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminSectionCard } from "./admin-section-card";

type AdminTableShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  children: ReactNode;
};

export function AdminTableShell({
  title,
  description,
  actions,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No rows found.",
  loadingMessage = "Loading...",
  className,
  children,
}: AdminTableShellProps) {
  return (
    <AdminSectionCard title={title} description={description} actions={actions} className={className}>
      {isLoading ? (
        <p className="text-sm text-slate-600">{loadingMessage}</p>
      ) : isEmpty ? (
        <p className="text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <div className={cn("admin-table-shell")}>{children}</div>
      )}
    </AdminSectionCard>
  );
}
