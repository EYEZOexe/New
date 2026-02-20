"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type MarketingNavProps = {
  rightSlot?: ReactNode;
};

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Pricing" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}

export function MarketingNav(props: MarketingNavProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const shouldShowLogin = !isLoading && !isAuthenticated;

  return (
    <header className="site-panel sticky top-4 z-40 px-4 py-3 md:px-5 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/18 text-sm font-semibold text-cyan-100 shadow-[0_12px_34px_-20px_rgba(39,209,255,0.8)] transition-colors group-hover:bg-cyan-400/24">
            G3
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">G3n S1gnals</p>
            <p className="hidden text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
              Signal workspace for disciplined traders
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Button
              asChild
              key={link.href}
              size="sm"
              variant={isActive(pathname, link.href) ? "secondary" : "ghost"}
              className={
                isActive(pathname, link.href)
                  ? "rounded-full border border-cyan-300/35 bg-cyan-400/20 px-4 text-cyan-100 hover:bg-cyan-400/26"
                  : "rounded-full px-4"
              }
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          {shouldShowLogin ? (
            <Button
              asChild
              size="sm"
              variant={isActive(pathname, "/login") ? "secondary" : "ghost"}
              className={
                isActive(pathname, "/login")
                  ? "rounded-full border border-cyan-300/35 bg-cyan-400/20 px-4 text-cyan-100 hover:bg-cyan-400/26"
                  : "rounded-full px-4"
              }
            >
              <Link href="/login">Log in</Link>
            </Button>
          ) : null}
          {props.rightSlot ? <div className="ml-1">{props.rightSlot}</div> : null}
        </nav>
      </div>
    </header>
  );
}
