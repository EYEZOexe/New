"use client";

import { Clock3, Search, Wifi } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { workspaceRoutes } from "@/lib/workspaceRoutes";

export function WorkspaceTopbar() {
  const [query, setQuery] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const activeRouteLabel = useMemo(() => {
    const matched = workspaceRoutes.find(
      (route) => pathname === route.href || pathname?.startsWith(`${route.href}/`),
    );
    return matched?.label ?? "Workspace";
  }, [pathname]);

  const matchingRoute = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;
    return (
      workspaceRoutes.find(
        (route) =>
          route.label.toLowerCase().includes(normalized) || route.key.toLowerCase().includes(normalized),
      ) ?? null
    );
  }, [query]);

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matchingRoute) return;
    console.info(`[workspace] topbar route search selected=${matchingRoute.href}`);
    router.push(matchingRoute.href);
    setQuery("");
  }

  return (
    <div className="workspace-topbar flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 md:px-5">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="rounded-full border border-border/70 bg-background/40 transition-colors hover:bg-background/60" />
        <div className="hidden items-center gap-2 md:flex">
          <Badge
            variant="outline"
            className="rounded-full border-cyan-300/35 bg-cyan-400/12 px-3 text-cyan-100"
          >
            {activeRouteLabel}
          </Badge>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Command Surface</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <form onSubmit={onSearchSubmit} className="relative hidden min-w-60 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 rounded-full border-border/70 bg-background/40 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to module..."
            aria-label="Search workspace"
            aria-description="Type a workspace module and press enter to navigate"
          />
        </form>
        <Badge variant="outline" className="rounded-full border-border/70 bg-background/45 text-foreground/90">
          <Clock3 className="size-3" />
          {clock.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </Badge>
        <Badge variant="outline" className="rounded-full border-emerald-400/45 bg-emerald-500/15 text-emerald-200">
          <Wifi className="size-3" />
          Live
        </Badge>
      </div>
    </div>
  );
}
