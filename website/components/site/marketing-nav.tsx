"use client";

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

  return (
    <header className="site-panel px-4 py-3 md:px-5 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-8 items-center rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 text-sm font-semibold text-cyan-100">
            Sleep Crypto
          </span>
          <span className="hidden text-sm text-muted-foreground md:inline">Signal workspace for disciplined traders</span>
        </Link>

        <nav className="flex items-center gap-2">
          {links.map((link) => (
            <Button
              asChild
              key={link.href}
              size="sm"
              variant={isActive(pathname, link.href) ? "secondary" : "ghost"}
              className="rounded-full px-4"
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          <Button asChild size="sm" variant={isActive(pathname, "/login") ? "secondary" : "ghost"} className="rounded-full px-4">
            <Link href="/login">Log in</Link>
          </Button>
          {props.rightSlot}
        </nav>
      </div>
    </header>
  );
}
