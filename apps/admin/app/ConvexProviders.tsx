"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function ConvexProviders({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      setError("Missing env: NEXT_PUBLIC_CONVEX_URL");
      return;
    }
    setClient(new ConvexReactClient(url));
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Configuration error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!client) return null;

  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}
