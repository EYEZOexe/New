import { SectionHeader } from "@/components/site/section-header";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  isLoggingOut: boolean;
  onLogout: () => void;
};

export function DashboardHeader(props: DashboardHeaderProps) {
  return (
    <SectionHeader
      badge="Dashboard"
      title="Notification command center."
      subtitle="Realtime subscription state, signal notifications, and Discord link controls in one place."
      navLinks={[
        { href: "/", label: "Home" },
        { href: "/shop", label: "Shop" },
      ]}
      highlights={[
        { label: "Feed mode", value: "Tier-filtered notifications" },
        { label: "Identity", value: "Discord link aware" },
        { label: "State", value: "Subscription synced" },
      ]}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="rounded-full px-4"
          onClick={props.onLogout}
          disabled={props.isLoggingOut}
        >
          {props.isLoggingOut ? "Logging out..." : "Log out"}
        </Button>
      }
    />
  );
}
