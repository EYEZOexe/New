import { WorkspaceDashboardScreen } from "@/app/workspace/overview/components/workspace-dashboard-screen";
import { WorkspaceAppFrame } from "@/components/workspace/workspace-app-frame";

export default function DashboardPage() {
  return (
    <WorkspaceAppFrame>
      <WorkspaceDashboardScreen />
    </WorkspaceAppFrame>
  );
}
