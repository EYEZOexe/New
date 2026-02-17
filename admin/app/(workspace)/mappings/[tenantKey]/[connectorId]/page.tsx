import { ConnectorWorkspace } from "@/components/mappings/connector-workspace";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type MappingsConnectorDetailPageProps = {
  params: Promise<{
    tenantKey: string;
    connectorId: string;
  }>;
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function MappingsConnectorDetailPage({
  params,
}: MappingsConnectorDetailPageProps) {
  const { tenantKey, connectorId } = await params;
  const decodedTenantKey = safeDecode(tenantKey);
  const decodedConnectorId = safeDecode(connectorId);
  const breadcrumbs = buildAdminBreadcrumbs(
    `/mappings/${encodeURIComponent(decodedTenantKey)}/${encodeURIComponent(decodedConnectorId)}`,
  );

  return (
    <ConnectorWorkspace
      tenantKey={decodedTenantKey}
      connectorId={decodedConnectorId}
      breadcrumbs={breadcrumbs}
    />
  );
}
