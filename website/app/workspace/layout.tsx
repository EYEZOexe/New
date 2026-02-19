import type { ReactNode } from "react";

import { WorkspaceAppFrame } from "@/components/workspace/workspace-app-frame";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <WorkspaceAppFrame>{children}</WorkspaceAppFrame>;
}
