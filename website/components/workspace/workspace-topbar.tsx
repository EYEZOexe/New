"use client";

import { Search, Wifi } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function WorkspaceTopbar() {
  return (
    <div className="workspace-topbar flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 md:px-5">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="rounded-full border border-border/70 bg-background/40" />
        <Badge variant="outline" className="hidden rounded-full bg-background/50 md:inline-flex">
          20% Fee Kickback
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden min-w-60 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 rounded-full border-border/70 bg-background/40 pl-9"
            placeholder="Search..."
            aria-label="Search workspace"
          />
        </div>
        <Badge variant="outline" className="rounded-full border-emerald-400/45 bg-emerald-500/15 text-emerald-200">
          <Wifi className="size-3" />
          Live
        </Badge>
      </div>
    </div>
  );
}

