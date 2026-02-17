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
  tableClassName?: string;
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
  tableClassName,
  children,
}: AdminTableShellProps) {
  return (
    <AdminSectionCard title={title} description={description} actions={actions} className={className}>
      {isLoading ? (
        <p className="text-sm text-slate-400">{loadingMessage}</p>
      ) : isEmpty ? (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <div className={cn("admin-table-shell", tableClassName)}>{children}</div>
      )}
    </AdminSectionCard>
  );
}
