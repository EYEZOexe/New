import Link from "next/link";

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
      title="Signal feed command center."
      subtitle="Realtime subscription state, tier-gated channel visibility, and Discord link controls in one place."
      navLinks={[
        { href: "/", label: "Home" },
        { href: "/shop", label: "Shop" },
      ]}
      actions={
        <Button size="sm" variant="outline" onClick={props.onLogout} disabled={props.isLoggingOut}>
          {props.isLoggingOut ? "Logging out..." : "Log out"}
        </Button>
      }
    />
  );
}
