import type { ReactNode } from "react";

import { PageFrame } from "@/components/site/page-frame";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <PageFrame>
      <section className="site-panel overflow-hidden p-0">
        <WorkspaceShell>{children}</WorkspaceShell>
      </section>
    </PageFrame>
  );
}
