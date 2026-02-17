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
import { getWorkspaceNavState } from "@/lib/workspaceRoutes";

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

const navItems = [
  { key: "overview", href: "/workspace/overview", label: "Overview" },
  { key: "markets", href: "/workspace/markets", label: "Markets" },
  { key: "live-intel", href: "/workspace/live-intel", label: "Live Intel" },
  { key: "signals", href: "/workspace/signals", label: "Signals & Alerts" },
  { key: "indicators", href: "/workspace/indicators", label: "Indicators" },
  { key: "strategies", href: "/workspace/strategies", label: "Strategies" },
  { key: "journal", href: "/workspace/journal", label: "Trading Journal" },
  { key: "news", href: "/workspace/news", label: "News" },
] as const;

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const state = getWorkspaceNavState(pathname ?? "/workspace/overview");

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/70">
      <SidebarHeader className="border-b border-border/70 px-4 py-4">
        <Link href="/workspace/overview" className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/25 p-1.5 text-primary">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Sleep Crypto Console</p>
            <p className="mt-1 text-xs text-muted-foreground">Workspace</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-3">
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = navIcons[item.key];
                const isActive = state.activeKey === item.key;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-primary/18 text-primary hover:bg-primary/22" : undefined}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
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
        <p className="text-xs text-muted-foreground">Connected</p>
      </SidebarFooter>
    </Sidebar>
  );
}

