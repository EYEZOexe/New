import type { ReactNode } from "react";
import Link from "next/link";

type AdminBreadcrumb = {
  label: string;
  href?: string;
};

type AdminPageHeaderProps = {
  chip?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: readonly (string | AdminBreadcrumb)[];
};

export function AdminPageHeader({
  chip,
  title,
  description,
  actions,
  breadcrumbs,
}: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {breadcrumbs.map((crumbEntry, index) => {
            const crumb =
              typeof crumbEntry === "string" ? { label: crumbEntry } : crumbEntry;
            return (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="font-medium text-slate-600 hover:text-slate-900"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-900">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 ? <span>/</span> : null}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {chip ? <p className="admin-chip">{chip}</p> : null}
          <h1 className="admin-title mt-3">{title}</h1>
          {description ? <p className="admin-subtitle max-w-3xl">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
