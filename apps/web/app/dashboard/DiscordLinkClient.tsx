"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export function DiscordLinkClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [unlinking, setUnlinking] = useState(false);

  const status = useMemo(() => search.get("discord"), [search]);

  async function unlink() {
    setUnlinking(true);
    try {
      const res = await fetch("/api/auth/discord/unlink", { method: "POST" });
      if (!res.ok) {
        // Best-effort: still refresh so server state is reflected.
      }
      router.refresh();
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ margin: "12px 0 8px" }}>Discord</h2>

      {status ? <p>Link status: <code>{status}</code></p> : null}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <a href="/api/auth/discord/start">Link Discord</a>
        <button onClick={unlink} disabled={unlinking}>
          {unlinking ? "Unlinking..." : "Unlink Discord"}
        </button>
      </div>
    </section>
  );
}

