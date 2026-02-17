"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminNavigation } from "./admin-sidebar";

type AdminMobileNavProps = {
  pathname: string;
};

export function AdminMobileNav({ pathname }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 border-r border-slate-800 bg-slate-950 p-0 text-slate-100">
        <SheetHeader className="border-b border-slate-800 p-5">
          <SheetTitle className="text-left text-base text-slate-100">Admin Workspace</SheetTitle>
        </SheetHeader>
        <div className="p-5">
          <AdminNavigation pathname={pathname} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
