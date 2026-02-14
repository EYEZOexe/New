"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pingStatus, setPingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pingResult, setPingResult] = useState<any>(null);

  async function ping() {
    if (pingStatus === "loading") return;
    setPingStatus("loading");
    try {
      const res = await fetch("/api/appwrite/ping", { method: "GET", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setPingResult(data);
      setPingStatus(data?.ok ? "success" : "error");
    } catch (err: any) {
      setPingResult({ ok: false, error: err?.message ?? "Ping failed" });
      setPingStatus("error");
    }
  }

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={ping} disabled={pingStatus === "loading"}>
          {pingStatus === "loading" ? "Pinging..." : "Ping Appwrite"}
        </button>
        <span>
          Ping:{" "}
          {pingStatus === "idle"
            ? "not run"
            : pingStatus === "loading"
              ? "loading"
              : pingStatus === "success"
                ? "ok"
                : "failed"}
        </span>
      </div>

      {pingResult ? (
        <pre style={{ margin: 0, padding: 12, background: "#111", color: "#eee", overflowX: "auto" }}>
          {JSON.stringify(pingResult, null, 2)}
        </pre>
      ) : null}

      <button onClick={logout} disabled={loading}>
        {loading ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
