"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export function DashboardClient() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
      <button onClick={logout} disabled={loading}>
        {loading ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
