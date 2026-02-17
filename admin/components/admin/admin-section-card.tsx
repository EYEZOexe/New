import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminSectionCardProps = ComponentProps<"section"> & {
  title?: string;
  description?: string;
  actions?: ReactNode;
};

export function AdminSectionCard({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: AdminSectionCardProps) {
  return (
    <section className={cn("admin-section-card", className)} {...props}>
      {title || description || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-sm font-semibold text-slate-100">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
