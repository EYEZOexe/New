import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type MarketingNavProps = {
  rightSlot?: ReactNode;
};

export function MarketingNav(props: MarketingNavProps) {
  return (
    <header className="rounded-2xl border border-border/70 bg-card/85 px-4 py-3 backdrop-blur-xl md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 text-sm font-semibold text-cyan-100">
            Sleep Crypto
          </span>
          <span className="text-sm text-muted-foreground">Signals for disciplined traders</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="rounded-full border border-border/70 px-4">
            <Link href="/shop">Pricing</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="rounded-full border border-border/70 px-4">
            <Link href="/login">Log in</Link>
          </Button>
          {props.rightSlot}
        </div>
      </div>
    </header>
  );
}
