"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
}

function normalizeConvexDeploymentUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const pathname = url.pathname.replace(/\/+$/, "");
  // Self-hosted docs often reference /http for HTTP actions, but ConvexReactClient
  // must target the deployment origin (no /http) for websocket sync.
  if (pathname === "/http") {
    url.pathname = "/";
  }
  return url.toString().replace(/\/$/, "");
}

export function AdminConvexProvider({ children }: { children: ReactNode }) {
  const client = useMemo(
    () => new ConvexReactClient(normalizeConvexDeploymentUrl(convexUrl!)),
    [],
  );

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
