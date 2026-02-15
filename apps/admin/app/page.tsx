"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export default function AdminHome() {
  const viewer = useQuery(makeFunctionReference<"query">("users:viewer"));

  const allowlist = parseAllowlist(process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST);

  if (viewer === undefined) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Admin Panel</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!viewer) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Admin Panel</h1>
        <p>
          You're not signed in. <Link href="/login">Login</Link>
        </p>
      </main>
    );
  }

  const email = (viewer.email ?? "").trim().toLowerCase();
  const isAllowed = allowlist.size > 0 && allowlist.has(email);
  if (!isAllowed) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Admin Panel</h1>
        <p>
          Forbidden for <strong>{viewer.email ?? "unknown"}</strong>.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Admin Panel</h1>
      <p>
        Signed in as <strong>{viewer.email}</strong>
      </p>
      <p>Placeholder for config, channel mapping, users, mirroring status.</p>
    </main>
  );
}

