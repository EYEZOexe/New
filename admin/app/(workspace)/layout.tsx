import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ConnectorStatsProvider } from "@/context/connector-stats-context";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <ConnectorStatsProvider>
      <AdminShell>{children}</AdminShell>
    </ConnectorStatsProvider>
  );
}
