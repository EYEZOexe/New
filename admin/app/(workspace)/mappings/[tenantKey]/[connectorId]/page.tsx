import { ConnectorWorkspace } from "@/components/mappings/connector-workspace";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

type MappingsConnectorDetailPageProps = {
  params: Promise<{
    tenantKey: string;
    connectorId: string;
  }>;
  searchParams: Promise<{ tab?: string }>;
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
  searchParams,
}: MappingsConnectorDetailPageProps) {
  const { tenantKey, connectorId } = await params;
  const { tab } = await searchParams;
  const decodedTenantKey = safeDecode(tenantKey);
  const decodedConnectorId = safeDecode(connectorId);
  const basePath = `/mappings/${encodeURIComponent(decodedTenantKey)}/${encodeURIComponent(decodedConnectorId)}`;
  const breadcrumbs = buildAdminBreadcrumbs(tab ? `${basePath}?tab=${encodeURIComponent(tab)}` : basePath);

  return (
    <ConnectorWorkspace
      tenantKey={decodedTenantKey}
      connectorId={decodedConnectorId}
      breadcrumbs={breadcrumbs}
    />
  );
}
