"use client";

import { useConvexAuth } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceTopbar } from "./workspace-topbar";

type WorkspaceShellProps = {
  children: ReactNode;
};

export function WorkspaceShell(props: WorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    const redirectTo = pathname && pathname.startsWith("/") ? pathname : "/dashboard";
    router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

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
