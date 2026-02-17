import { redirect } from "next/navigation";

type LegacyConnectorDetailPageProps = {
  params: Promise<{
    tenantKey: string;
    connectorId: string;
  }>;
};

export default async function LegacyConnectorDetailPage({
  params,
}: LegacyConnectorDetailPageProps) {
  const { tenantKey, connectorId } = await params;
  redirect(`/mappings/${encodeURIComponent(tenantKey)}/${encodeURIComponent(connectorId)}`);
}
