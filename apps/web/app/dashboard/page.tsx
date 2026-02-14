import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth";
import { DashboardClient } from "./DashboardClient";
import { DiscordLinkClient } from "./DiscordLinkClient";

// This page depends on request cookies + server-side Appwrite calls, so it must not be
// statically prerendered at build time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardHome() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  // NOTE: paid membership will be managed by sell.app webhook function.
  if (!auth.paid) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Dashboard</h1>
        <p>
          Logged in as <strong>{auth.email}</strong>
        </p>
        <p>
          Your account is not active yet. After purchase, the webhook will add you
          to the <code>paid</code> team.
        </p>
        <p>
          You can still link Discord now. Roles will be granted once your subscription is active.
        </p>
        <p>
          <Link href="/">Back to home</Link>
        </p>

        <DiscordLinkClient />

        <DashboardClient />
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>
        Welcome, <strong>{auth.name || auth.email}</strong>
      </p>

      <p>Paid access: ✅</p>

      <p>
        Next steps: signal feed, alerts, Discord linking.
      </p>

      <DiscordLinkClient />

      <DashboardClient />
    </main>
  );
}
