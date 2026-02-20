export type ViewerConnectorOption = {
  tenantKey: string;
  connectorId: string;
  configuredChannelCount: number;
  visibleChannelCount: number;
};

export type ConnectorSelection = {
  tenantKey: string;
  connectorId: string;
};

const CONNECTOR_SELECTION_SEPARATOR = "::";

function normalizeKey(value: string): string {
  return value.trim();
}

export function serializeConnectorSelection(selection: ConnectorSelection): string {
  const tenantKey = normalizeKey(selection.tenantKey);
  const connectorId = normalizeKey(selection.connectorId);
  if (!tenantKey || !connectorId) {
    return "";
  }
  return `${tenantKey}${CONNECTOR_SELECTION_SEPARATOR}${connectorId}`;
}

export function parseConnectorSelection(raw: string | null | undefined): ConnectorSelection | null {
  const value = (raw ?? "").trim();
  if (!value) {
    return null;
  }

  const separatorIndex = value.indexOf(CONNECTOR_SELECTION_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }

  const tenantKey = normalizeKey(value.slice(0, separatorIndex));
  const connectorId = normalizeKey(value.slice(separatorIndex + CONNECTOR_SELECTION_SEPARATOR.length));
  if (!tenantKey || !connectorId) {
    return null;
  }

  return {
    tenantKey,
    connectorId,
  };
}

export function isConnectorOptionMatch(
  option: ViewerConnectorOption,
  selection: ConnectorSelection | null,
): boolean {
  if (!selection) return false;
  return (
    option.tenantKey === normalizeKey(selection.tenantKey) &&
    option.connectorId === normalizeKey(selection.connectorId)
  );
}

export function resolvePreferredConnectorSelection(args: {
  options: ViewerConnectorOption[] | null | undefined;
  currentSelection: ConnectorSelection | null;
}): ConnectorSelection | null {
  const options = args.options ?? [];
  if (options.length === 0) return null;

  const current = args.currentSelection;
  if (current && options.some((option) => isConnectorOptionMatch(option, current))) {
    return {
      tenantKey: normalizeKey(current.tenantKey),
      connectorId: normalizeKey(current.connectorId),
    };
  }

  return {
    tenantKey: options[0].tenantKey,
    connectorId: options[0].connectorId,
  };
}
