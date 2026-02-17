import { ConnectorWorkspace } from "@/components/mappings/connector-workspace";

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

  return (
    <ConnectorWorkspace
      tenantKey={safeDecode(tenantKey)}
      connectorId={safeDecode(connectorId)}
    />
  );
}
