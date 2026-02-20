"use client";

import {
  BellRing,
  BookOpen,
  CandlestickChart,
  LayoutDashboard,
  LineChart,
  Newspaper,
  Radar,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getWorkspaceNavState, workspaceRoutes } from "@/lib/workspaceRoutes";

const navIcons = {
  overview: LayoutDashboard,
  markets: CandlestickChart,
  "live-intel": Radar,
  signals: BellRing,
  indicators: LineChart,
  strategies: BookOpen,
  journal: ScrollText,
  news: Newspaper,
} as const;

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const state = getWorkspaceNavState(pathname ?? "/dashboard");

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/70 bg-background/35 backdrop-blur-xl">
      <SidebarHeader className="relative border-b border-border/70 px-4 py-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="rounded-xl border border-cyan-300/35 bg-cyan-400/15 p-2 text-primary shadow-[0_12px_32px_-18px_rgba(58,190,255,0.9)] transition-colors group-hover:bg-cyan-400/22">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Sleep Crypto Console</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Member Workspace</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-3">
          <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/90">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceRoutes.map((item, index) => {
                const Icon = navIcons[item.key];
                const isActive = state.activeKey === item.key;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={
                        isActive
                          ? "rounded-xl border border-cyan-300/35 bg-cyan-400/20 text-cyan-100 shadow-[0_18px_42px_-28px_rgba(53,187,255,0.95)] hover:bg-cyan-400/24"
                          : "rounded-xl border border-transparent hover:border-border/70 hover:bg-background/45"
                      }
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/70 px-4 py-3">
        <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Connected</p>
          <p className="mt-1 text-xs text-foreground/90">{workspaceRoutes.length} modules ready</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
