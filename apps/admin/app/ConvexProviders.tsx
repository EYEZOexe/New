"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { useMemo } from "react";

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_CONVEX_URL");
  return url;
}

export function ConvexProviders({ children }: { children: ReactNode }) {
  const client = useMemo(() => new ConvexReactClient(getConvexUrl()), []);
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}

