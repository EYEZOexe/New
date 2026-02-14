"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

import { DashboardClient } from "./DashboardClient";

export default function DashboardHome() {
  const viewer = useQuery(makeFunctionReference<"query">("users:viewer"));

  if (viewer === undefined) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Dashboard</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!viewer) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Dashboard</h1>
        <p>
          You're not signed in. <Link href="/login">Login</Link>
        </p>
        <p>
          Or <Link href="/signup">create an account</Link>.
        </p>
        <p>
          <Link href="/">Back to home</Link>
        </p>
      </main>
    );
  }

  const isPaid = viewer.subscription?.status === "active";

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>
        Logged in as <strong>{viewer.email ?? "unknown"}</strong>
      </p>

      <p>
        Paid access: {isPaid ? "✅" : "❌"} {!isPaid ? "(Sell.app webhook not migrated yet)" : null}
      </p>

      {!isPaid ? (
        <p>
          Once payments are migrated to Convex, your subscription will be marked active automatically.
        </p>
      ) : null}

      <p>
        Discord linking: <em>coming soon</em>
      </p>

      <DashboardClient />
    </main>
  );
}
