import type { ReactNode } from "react";

import { PageFrame } from "@/components/site/page-frame";

import { WorkspaceShell } from "./workspace-shell";

type WorkspaceAppFrameProps = {
  children: ReactNode;
};

export function WorkspaceAppFrame(props: WorkspaceAppFrameProps) {
  return (
    <PageFrame>
      <section className="site-panel site-animate-in overflow-hidden p-0">
        <WorkspaceShell>{props.children}</WorkspaceShell>
      </section>
    </PageFrame>
  );
}
