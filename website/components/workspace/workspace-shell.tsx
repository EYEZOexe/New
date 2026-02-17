"use client";

import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceTopbar } from "./workspace-topbar";

type WorkspaceShellProps = {
  children: ReactNode;
};

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <WorkspaceSidebar />
      <SidebarInset className="min-h-[72vh] bg-transparent">
        <WorkspaceTopbar />
        <div className="workspace-main space-y-6 px-4 py-4 md:px-5 md:py-5">{props.children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

