import { RoleConfigPanel } from "@/components/discord-bot/role-config-panel";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

export default function DiscordBotPage() {
  return <RoleConfigPanel breadcrumbs={buildAdminBreadcrumbs("/discord-bot")} />;
}
