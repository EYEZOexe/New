import type { ReactNode } from "react";

type WorkspaceSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function WorkspaceSectionHeader(props: WorkspaceSectionHeaderProps) {
  return (
    <div className="site-soft flex flex-wrap items-start justify-between gap-4 px-5 py-4 md:px-6">
      <div className="max-w-4xl">
        <p className="site-kicker">Workspace Module</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{props.title}</h1>
        {props.description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">{props.description}</p>
        ) : null}
      </div>
      {props.actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{props.actions}</div> : null}
    </div>
  );
}
